/**
 * Battle City 1990 - Professional Gamepad Input Manager
 * Supports Xbox, DualShock/DualSense, 8BitDo, Switch Pro, and standard USB NES gamepads.
 * 
 * Features:
 * - Full Dual-Controller Isolation (Zero Cross-Interference / No Edge-Lockouts)
 * - Intelligent Active-Controller Menu Routing (P1 Priority with Seamless Intent-Based Switching)
 * - Safe Deadzone Calibration & Analog Trigger Filtering (Prevents stick drift & false trigger fires)
 * - Discrete Ordinal Mapping for Local 2-Player Combat (P1 = Pad 0, P2 = Pad 1)
 */

import { InputState } from '../types';

export interface GamepadInfo {
  id: string;
  connected: boolean;
  index: number;
  playerNum?: 1 | 2;
}

export interface MenuGamepadInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean;
  cancel: boolean;
  start: boolean;
  select: boolean;
  buttonA?: boolean;
  buttonB?: boolean;
  buttonX?: boolean;
  buttonY?: boolean;
  lb?: boolean;
  rb?: boolean;
  anyButton: boolean;
  sourcePadIndex?: number;
}

class GamepadManager {
  private activeGamepadIndex: number | null = null;
  private onConnectionChangeCallbacks: ((info: GamepadInfo | null) => void)[] = [];
  
  // Button edges are tracked PER PAD to prevent phantom edges across controllers
  private prevStartByPad = new Map<number, boolean>();
  private prevSelectByPad = new Map<number, boolean>();

  // Active controller tracking for Menus:
  // Defaults to Controller 0 (Player 1). If Controller 1 has an intentional press,
  // it seamlessly takes over menu control without merging booleans or causing deadlocks.
  private activeMenuPadOrdinal: number = 0;
  
  // Track stick return-to-center per pad to completely eliminate menu scroll lock on drifting sticks
  private stickNeutralByPad = new Map<number, boolean>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('gamepadconnected', this.handleConnected);
      window.addEventListener('gamepaddisconnected', this.handleDisconnected);
    }
  }

  private handleConnected = (e: GamepadEvent) => {
    if (this.activeGamepadIndex === null) {
      this.activeGamepadIndex = e.gamepad.index;
    }
    this.notifyConnectionChange({
      id: e.gamepad.id,
      connected: true,
      index: e.gamepad.index,
    });
  };

  private handleDisconnected = (e: GamepadEvent) => {
    if (this.activeGamepadIndex === e.gamepad.index) {
      this.activeGamepadIndex = null;
      this.notifyConnectionChange(null);
    }
    // Clean up per-pad maps
    this.prevStartByPad.delete(e.gamepad.index);
    this.prevSelectByPad.delete(e.gamepad.index);
    this.stickNeutralByPad.delete(e.gamepad.index);
    this.activeMenuPadOrdinal = 0;
  };

  public onConnectionChange(cb: (info: GamepadInfo | null) => void) {
    this.onConnectionChangeCallbacks.push(cb);
    return () => {
      this.onConnectionChangeCallbacks = this.onConnectionChangeCallbacks.filter((c) => c !== cb);
    };
  }

  private notifyConnectionChange(info: GamepadInfo | null) {
    for (const cb of this.onConnectionChangeCallbacks) {
      cb(info);
    }
  }

  /**
   * Returns valid, real gamepads currently connected.
   * Filters out disconnected slots, virtual mice, headsets, or zero-button devices.
   */
  public getConnectedPads(): Gamepad[] {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
    const raw = navigator.getGamepads ? navigator.getGamepads() : [];
    const out: Gamepad[] = [];
    for (let i = 0; i < raw.length; i++) {
      const gp = raw[i];
      if (gp && gp.connected && gp.buttons && gp.buttons.length >= 4) {
        out.push(gp);
      }
    }
    return out;
  }

  public getConnectedGamepad(): GamepadInfo | null {
    const pads = this.getConnectedPads();
    if (pads.length > 0) {
      const gp = pads[0];
      return {
        id: gp.id,
        connected: true,
        index: gp.index,
        playerNum: 1,
      };
    }
    return null;
  }

  /**
   * Helper to safely read a gamepad button.
   * Prevents analog triggers (L2/R2) or noisy buttons from triggering when resting at > 0.0.
   */
  private isButtonPressed(btn: GamepadButton | undefined): boolean {
    if (!btn) return false;
    if (typeof btn.value === 'number') {
      return btn.value > 0.5;
    }
    return Boolean(btn.pressed);
  }

  /**
   * Reads the current gamepad state and translates to InputState (for single-player)
   */
  public pollInput(): { input: Partial<InputState>; selectPressed: boolean } | null {
    const pads = this.getConnectedPads();
    if (pads.length === 0) return null;
    return this.readPad(pads[0]);
  }

  /**
   * Polls the Nth connected pad regardless of its raw slot index
   * (0 = Player 1 -> Gold Tank, 1 = Player 2 -> Green Tank).
   * Complete hardware separation ensures zero cross-interference.
   */
  public pollInputForOrdinal(ordinal: number): { input: Partial<InputState>; selectPressed: boolean } | null {
    const pads = this.getConnectedPads();
    const pad = pads[ordinal];
    if (!pad) return null;
    return this.readPad(pad);
  }

  /**
   * Online play: one player per machine.
   */
  public pollInputForRole(role: 'any' | 'host' | 'guest'): { input: Partial<InputState>; selectPressed: boolean } | null {
    const connected = this.getConnectedPads();
    if (connected.length === 0) return null;
    const pad = role === 'guest' && connected.length >= 2 ? connected[1] : connected[0];
    return this.readPad(pad);
  }

  /**
   * Pure in-game input decoder with dedicated 0.45 deadzone and safe trigger filtering.
   */
  private readPad(pad: Gamepad): { input: Partial<InputState>; selectPressed: boolean } {
    const axisX = pad.axes[0] || 0;
    const axisY = pad.axes[1] || 0;
    const deadzone = 0.45;

    const dpadUp = this.isButtonPressed(pad.buttons[12]);
    const dpadDown = this.isButtonPressed(pad.buttons[13]);
    const dpadLeft = this.isButtonPressed(pad.buttons[14]);
    const dpadRight = this.isButtonPressed(pad.buttons[15]);

    const up = dpadUp || axisY < -deadzone;
    const down = dpadDown || axisY > deadzone;
    const left = dpadLeft || axisX < -deadzone;
    const right = dpadRight || axisX > deadzone;

    // Fire: Button 0 (A/Cross), Button 1 (B/Circle), Button 2 (X/Square)
    // For Button 7 (R2), only fire if clearly pulled > 0.5 (prevents analog trigger autofire)
    const fire = Boolean(
      this.isButtonPressed(pad.buttons[0]) ||
      this.isButtonPressed(pad.buttons[1]) ||
      this.isButtonPressed(pad.buttons[2]) ||
      this.isButtonPressed(pad.buttons[7])
    );

    // Tactical weapons: L1 = Smoke, R1 = Grenade, L2 / Y = Shield
    const smoke = Boolean(this.isButtonPressed(pad.buttons[4]));
    const grenade = Boolean(this.isButtonPressed(pad.buttons[5]));
    const shield = Boolean(this.isButtonPressed(pad.buttons[3]) || this.isButtonPressed(pad.buttons[6]));

    // Button 9: Start (Pause) - edge trigger, tracked per pad
    const startCurrent = Boolean(this.isButtonPressed(pad.buttons[9]));
    const pauseTrigger = startCurrent && !(this.prevStartByPad.get(pad.index) ?? false);
    this.prevStartByPad.set(pad.index, startCurrent);

    // Button 8: Select (Mode switch) - edge trigger, tracked per pad
    const selectCurrent = Boolean(this.isButtonPressed(pad.buttons[8]));
    const selectTrigger = selectCurrent && !(this.prevSelectByPad.get(pad.index) ?? false);
    this.prevSelectByPad.set(pad.index, selectCurrent);

    return {
      input: {
        up,
        down,
        left,
        right,
        fire,
        pause: pauseTrigger,
        smoke,
        grenade,
        shield,
      },
      selectPressed: selectTrigger,
    };
  }

  /**
   * Polls connected gamepads specifically for Menu / UI navigation.
   * 
   * Architectural Guarantee:
   * 1. NEVER merges raw states across pads with `||` (which causes permanent edge-lockouts and drift paralysis).
   * 2. Routes input from the Active Controller cleanly. If P1 is idle and P2 presses a button/D-pad,
   *    P2 seamlessly becomes the active menu controller without blocking P1's future presses.
   * 3. Completely ignores analog drift from inactive controllers on the desk.
   */
  public pollMenuInput(): MenuGamepadInput | null {
    const pads = this.getConnectedPads();
    if (pads.length === 0) return null;

    // Ensure active menu pad is within bounds
    if (this.activeMenuPadOrdinal >= pads.length) {
      this.activeMenuPadOrdinal = 0;
    }

    // Step 1: Detect intentional actions on each pad
    // (Intentional = D-Pad, Face Buttons, Menu Buttons, or large stick movement > 0.65)
    let pad0HasIntent = false;
    let otherPadIntentOrdinal = -1;

    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      const hasDpad = this.isButtonPressed(p.buttons[12]) ||
                      this.isButtonPressed(p.buttons[13]) ||
                      this.isButtonPressed(p.buttons[14]) ||
                      this.isButtonPressed(p.buttons[15]);

      const hasFaceBtn = this.isButtonPressed(p.buttons[0]) || // A
                         this.isButtonPressed(p.buttons[1]) || // B
                         this.isButtonPressed(p.buttons[2]) || // X
                         this.isButtonPressed(p.buttons[3]);   // Y

      const hasMenuBtn = this.isButtonPressed(p.buttons[8]) || // Select
                         this.isButtonPressed(p.buttons[9]) || // Start
                         this.isButtonPressed(p.buttons[4]) || // LB
                         this.isButtonPressed(p.buttons[5]);   // RB

      const axX = p.axes[0] || 0;
      const axY = p.axes[1] || 0;
      const hasStickIntent = Math.abs(axX) > 0.65 || Math.abs(axY) > 0.65;

      const hasIntent = hasDpad || hasFaceBtn || hasMenuBtn || hasStickIntent;

      if (i === 0) {
        pad0HasIntent = hasIntent;
      } else if (hasIntent && otherPadIntentOrdinal === -1) {
        otherPadIntentOrdinal = i;
      }
    }

    // Step 2: Decide active controller
    // If Player 1 (Pad 0) makes any action, Pad 0 always takes priority
    if (pad0HasIntent) {
      this.activeMenuPadOrdinal = 0;
    } else if (otherPadIntentOrdinal !== -1) {
      // If Player 1 is idle, and Player 2 makes a deliberate action, allow Player 2 to control
      this.activeMenuPadOrdinal = otherPadIntentOrdinal;
    }

    // Step 3: Read ONLY from the active controller (Zero cross-contamination)
    const activePad = pads[this.activeMenuPadOrdinal] || pads[0];
    const padIdx = activePad.index;

    // Strict Menu Deadzone (0.65) + D-Pad priority
    const axisX = activePad.axes[0] || 0;
    const axisY = activePad.axes[1] || 0;
    const menuDeadzone = 0.65;

    // Analog stick return-to-center check (hysteresis) to prevent drift hold
    const isStickCentered = Math.abs(axisX) < 0.30 && Math.abs(axisY) < 0.30;
    if (isStickCentered) {
      this.stickNeutralByPad.set(padIdx, true);
    }
    const canUseStick = this.stickNeutralByPad.get(padIdx) ?? true;

    const dpadUp = this.isButtonPressed(activePad.buttons[12]);
    const dpadDown = this.isButtonPressed(activePad.buttons[13]);
    const dpadLeft = this.isButtonPressed(activePad.buttons[14]);
    const dpadRight = this.isButtonPressed(activePad.buttons[15]);

    const stickUp = canUseStick && axisY < -menuDeadzone;
    const stickDown = canUseStick && axisY > menuDeadzone;
    const stickLeft = canUseStick && axisX < -menuDeadzone;
    const stickRight = canUseStick && axisX > menuDeadzone;

    if (stickUp || stickDown || stickLeft || stickRight) {
      this.stickNeutralByPad.set(padIdx, false);
    }

    const up = dpadUp || stickUp;
    const down = dpadDown || stickDown;
    const left = dpadLeft || stickLeft;
    const right = dpadRight || stickRight;

    // Button Mappings (Standard XInput / DirectInput / Switch)
    const buttonA = this.isButtonPressed(activePad.buttons[0]); // A / Cross
    const buttonB = this.isButtonPressed(activePad.buttons[1]); // B / Circle
    const buttonX = this.isButtonPressed(activePad.buttons[2]); // X / Square
    const buttonY = this.isButtonPressed(activePad.buttons[3]); // Y / Triangle
    const lb = this.isButtonPressed(activePad.buttons[4]);      // LB / L1
    const rb = this.isButtonPressed(activePad.buttons[5]);      // RB / R1
    const start = this.isButtonPressed(activePad.buttons[9]);   // Start / Options
    const select = this.isButtonPressed(activePad.buttons[8]);  // Select / Back

    // Confirm: A or X
    const confirm = buttonA || buttonX;
    // Cancel: B
    const cancel = buttonB;

    let anyButton = false;
    for (let b = 0; b < activePad.buttons.length; b++) {
      // Exclude analog triggers (buttons 6 and 7) from general "anyButton" wakeups
      if (b === 6 || b === 7) continue;
      if (this.isButtonPressed(activePad.buttons[b])) {
        anyButton = true;
        break;
      }
    }

    return {
      up,
      down,
      left,
      right,
      confirm,
      cancel,
      start,
      select,
      buttonA,
      buttonB,
      buttonX,
      buttonY,
      lb,
      rb,
      anyButton,
      sourcePadIndex: this.activeMenuPadOrdinal,
    };
  }
}

export const gamepadManager = new GamepadManager();
