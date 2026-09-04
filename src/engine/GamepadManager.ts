/**
 * Battle City 1990 - Gamepad Input Manager
 * Supports Xbox, DualShock/DualSense, 8BitDo, and standard USB NES gamepads
 */

import { InputState } from '../types';

export interface GamepadInfo {
  id: string;
  connected: boolean;
  index: number;
}

class GamepadManager {
  private activeGamepadIndex: number | null = null;
  private onConnectionChangeCallbacks: ((info: GamepadInfo | null) => void)[] = [];
  // Button edges are tracked PER PAD: one shared flag mixes Start states of
  // different pads when several are polled, producing phantom edges.
  private prevStartByPad = new Map<number, boolean>();
  private prevSelectByPad = new Map<number, boolean>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('gamepadconnected', this.handleConnected);
      window.addEventListener('gamepaddisconnected', this.handleDisconnected);
    }
  }

  private handleConnected = (e: GamepadEvent) => {
    // Stick to the first pad (P1 convention); later pads stay available for P2
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

  public getConnectedGamepad(): GamepadInfo | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp && gp.connected) {
        return {
          id: gp.id,
          connected: true,
          index: gp.index,
        };
      }
    }
    return null;
  }

  /**
   * Reads the current gamepad state and translates to InputState
   */
  public pollInput(): { input: Partial<InputState>; selectPressed: boolean } | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const gamepads = navigator.getGamepads();
    let pad: Gamepad | null = null;

    if (this.activeGamepadIndex !== null && gamepads[this.activeGamepadIndex]) {
      pad = gamepads[this.activeGamepadIndex];
    } else {
      // Find first connected gamepad
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i]!.connected) {
          pad = gamepads[i];
          this.activeGamepadIndex = i;
          break;
        }
      }
    }

    if (!pad || !pad.connected) return null;
    return this.readPad(pad);
  }

  /**
   * Connected pads in ordinal order (0 = first, 1 = second). Raw slot
   * indices can have gaps, so ordinal position is the reliable mapping.
   */
  public getConnectedPads(): Gamepad[] {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
    const raw = navigator.getGamepads ? navigator.getGamepads() : [];
    const out: Gamepad[] = [];
    for (let i = 0; i < raw.length; i++) {
      const gp = raw[i];
      if (gp && gp.connected) out.push(gp);
    }
    return out;
  }

  /**
   * Polls the Nth connected pad regardless of its raw slot index
   * (0 = first pad -> P1, 1 = second pad -> P2)
   */
  public pollInputForOrdinal(ordinal: number): { input: Partial<InputState>; selectPressed: boolean } | null {
    const pad = this.getConnectedPads()[ordinal];
    if (!pad) return null;
    return this.readPad(pad);
  }

  /**
   * Online play: one player per machine. A single pad drives the local tank
   * whatever the role; when two pads share one machine (same-machine online
   * testing), the host takes the first and the guest the second.
   */
  public pollInputForRole(role: 'any' | 'host' | 'guest'): { input: Partial<InputState>; selectPressed: boolean } | null {
    const connected = this.getConnectedPads();
    if (connected.length === 0) return null;
    const pad = role === 'guest' && connected.length >= 2 ? connected[1] : connected[0];
    return this.readPad(pad);
  }

  private readPad(pad: Gamepad): { input: Partial<InputState>; selectPressed: boolean } {
    // Axes: 0 = Left/Right, 1 = Up/Down
    const axisX = pad.axes[0] || 0;
    const axisY = pad.axes[1] || 0;
    const deadzone = 0.35;

    const dpadUp = pad.buttons[12]?.pressed ?? false;
    const dpadDown = pad.buttons[13]?.pressed ?? false;
    const dpadLeft = pad.buttons[14]?.pressed ?? false;
    const dpadRight = pad.buttons[15]?.pressed ?? false;

    const up = dpadUp || axisY < -deadzone;
    const down = dpadDown || axisY > deadzone;
    const left = dpadLeft || axisX < -deadzone;
    const right = dpadRight || axisX > deadzone;

    // Fire: Buttons 0 (A/Cross), 1 (B/Circle), 2 (X/Square), 7 (R2)
    const fire = Boolean(
      pad.buttons[0]?.pressed ||
      pad.buttons[1]?.pressed ||
      pad.buttons[2]?.pressed ||
      pad.buttons[7]?.pressed
    );

    // Tactical weapons: L1 = Smoke, R1 = Grenade, L2 / Y = Shield
    const smoke = Boolean(pad.buttons[4]?.pressed);
    const grenade = Boolean(pad.buttons[5]?.pressed);
    const shield = Boolean(pad.buttons[6]?.pressed || pad.buttons[3]?.pressed);

    // Button 9: Start (Pause) - edge trigger, tracked per pad
    const startCurrent = Boolean(pad.buttons[9]?.pressed);
    const pauseTrigger = startCurrent && !(this.prevStartByPad.get(pad.index) ?? false);
    this.prevStartByPad.set(pad.index, startCurrent);

    // Button 8: Select (Mode switch) - edge trigger, tracked per pad
    const selectCurrent = Boolean(pad.buttons[8]?.pressed);
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
}

export const gamepadManager = new GamepadManager();
