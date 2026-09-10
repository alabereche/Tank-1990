/**
 * Battle City 1990 - React 18+ Main Application
 * Coordinates Screen Management: Title Menu, Construction Editor,
 * Stage Curtain Intro, 60 FPS Canvas Battle, and Victory / Game Over Score Screens.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GameState, GameScore, StageMap, GameSettings, MultiplayerMode, MultiplayerRole } from './types';
import { TitleScreen } from './components/TitleScreen';
import { GameCanvas } from './components/GameCanvas';
import { MapEditorToolbar } from './components/MapEditorToolbar';
import { StageIntro } from './components/StageIntro';
import { GameOverModal } from './components/GameOverModal';
import { SettingsModal } from './components/SettingsModal';
import { WifiCoopModal } from './components/WifiCoopModal';
import { SecretStatsModal } from './components/SecretStatsModal';
import { ArcadeCabinetFrame } from './components/ArcadeCabinetFrame';
import { PRESET_MAPS, getStageMapForPresetAndStage, MAP_SIZE_CONFIGS } from './engine/maps';
import { soundManager } from './engine/SoundManager';
import { gamepadManager, GamepadInfo } from './engine/GamepadManager';
import { toggleFullscreen, isElectronApp, isStandaloneApp } from './utils/fullscreen';
import { localP2PService } from './services/LocalP2PService';
import { analyticsService } from './services/AnalyticsService';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<GameState>(GameState.MENU);
  const [currentStage, setCurrentStage] = useState<number>(1);
  const [customMap, setCustomMap] = useState<StageMap | undefined>(undefined);
  const [editorInitialMap, setEditorInitialMap] = useState<StageMap | undefined>(undefined);
  const [finalScoreData, setFinalScoreData] = useState<GameScore | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isWifiCoopOpen, setIsWifiCoopOpen] = useState<boolean>(false);
  const [pwaPrompt, setPwaPrompt] = useState<any>(null);
  const [showPwaBanner, setShowPwaBanner] = useState<boolean>(false);
  const [showSecretStats, setShowSecretStats] = useState<boolean>(false);
  const [multiplayerConfig, setMultiplayerConfig] = useState<{
    roomCode: string;
    role: MultiplayerRole;
    mode: MultiplayerMode;
    versusSubMode?: 'classic' | 'payload';
    mapSize: 'classic' | 'large' | 'giant';
    stage: number;
    customMapGrid?: number[][];
    slot?: number;
    team?: 'A' | 'B' | 'FFA';
  } | undefined>(undefined);

  const [highScore, setHighScore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('battle_city_high_score');
      return saved ? parseInt(saved, 10) || 20000 : 20000;
    } catch {
      return 20000;
    }
  });

  const [settings, setSettings] = useState<GameSettings>(() => {
    const isMobileDevice =
      typeof navigator !== 'undefined' &&
      (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (typeof window !== 'undefined' && window.innerWidth <= 960 && 'ontouchstart' in window));

    try {
      const saved = localStorage.getItem('battle_city_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          mapSize: parsed.mapSize || 'classic',
          playerSpeed: 1.1,
          showScanlines: isMobileDevice ? Boolean(parsed.showScanlines) : parsed.showScanlines !== false,
          soundEnabled: parsed.soundEnabled !== false,
          windowScale: parsed.windowScale || 'large',
        };
      }
    } catch {}
    return {
      mapSize: 'classic',
      playerSpeed: 1.1,
      showScanlines: !isMobileDevice,
      soundEnabled: true,
      windowScale: 'large',
    };
  });

  const [connectedGamepad, setConnectedGamepad] = useState<GamepadInfo | null>(null);
  const [gamepadAlert, setGamepadAlert] = useState<string | null>(null);

  // Monitor Gamepad connection
  useEffect(() => {
    const unsub = gamepadManager.onConnectionChange((gp) => {
      setConnectedGamepad(gp);
      if (gp && gp.connected) {
        const pads = gamepadManager.getConnectedPads();
        if (pads.length >= 2) {
          setGamepadAlert('DUAL GAMEPADS CONNECTED: P1 (GOLD) & P2 (GREEN) READY!');
        } else {
          setGamepadAlert(`GAMEPAD CONNECTED: P1 (${gp.id.split('(')[0].trim()})`);
        }
        setTimeout(() => setGamepadAlert(null), 4500);
      }
    });

    const current = gamepadManager.getConnectedGamepad();
    if (current) setConnectedGamepad(current);

    return unsub;
  }, []);

  // Ensure tank engine sound is immediately silenced when leaving the active battlefield
  useEffect(() => {
    if (currentScreen !== GameState.PLAYING) {
      soundManager.stopEngineSound();
    }
  }, [currentScreen]);

  // Synchronize Menu Background Music with active screen: play in MENU, stop during combat/stage intro/editor
  useEffect(() => {
    if (currentScreen === GameState.MENU) {
      soundManager.playMenuMusic();
    } else {
      soundManager.stopMenuMusic();
    }
  }, [currentScreen]);

  // Global keydown handler for Fullscreen (Web browser only)
  useEffect(() => {
    if (isElectronApp()) return;
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // Omni-Unlock Audio: instantly unlock AudioContext on any user interaction anywhere
  useEffect(() => {
    const unlock = () => {
      soundManager.unlockAudio();
    };
    const events = ['click', 'pointerdown', 'keydown', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, unlock, { capture: true, passive: true }));
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, unlock, { capture: true }));
    };
  }, []);

  // Synchronize Mute status with Settings
  useEffect(() => {
    soundManager.setMuted(!settings.soundEnabled);
  }, [settings.soundEnabled]);

  const handleUpdateSettings = (newSettings: GameSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('battle_city_settings', JSON.stringify(newSettings));
    } catch {}
  };


  // Silent Visitor Analytics & ?stats / ?admin URL Parameter Detection
  useEffect(() => {
    analyticsService.trackVisit();

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('stats') || params.has('admin')) {
        setShowSecretStats(true);
      }
    }
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPwaPrompt(e);
      if (!isStandaloneApp()) {
        setShowPwaBanner(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPwa = async () => {
    soundManager.unlockAudio();
    if (pwaPrompt) {
      try {
        pwaPrompt.prompt();
        await pwaPrompt.userChoice;
      } catch {}
      setPwaPrompt(null);
      setShowPwaBanner(false);
    }
  };


  // Handlers for Transitions
  const handleStartGame = (stageOverride?: number) => {
    analyticsService.track('play_game');
    soundManager.stopMenuMusic();
    soundManager.unlockAudio();
    const stg = stageOverride ?? currentStage ?? 1;
    setCurrentStage(stg);
    setCustomMap(undefined);
    setCurrentScreen(GameState.STAGE_START);
  };

  const handleOpenConstruction = (initialMap?: StageMap) => {
    soundManager.stopMenuMusic();
    soundManager.unlockAudio();
    setEditorInitialMap(initialMap);
    setCurrentScreen(GameState.BUILDING);
  };

  const handlePlayCustomMap = (map: StageMap) => {
    analyticsService.track('play_game');
    soundManager.stopMenuMusic();
    soundManager.unlockAudio();
    setCustomMap(map);
    setCurrentStage(1);
    const isPayload = map.grid.length === 34 || map.name.toLowerCase().includes('badwater');
    if (isPayload) {
      setMultiplayerConfig({
        roomCode: 'LOCAL',
        role: 'host',
        mode: 'versus',
        versusSubMode: 'payload',
        mapSize: 'large',
        stage: 1,
      });
    }
    setCurrentScreen(GameState.STAGE_START);
  };

  const handleStageIntroComplete = () => {
    soundManager.stopMenuMusic();
    setCurrentScreen(GameState.PLAYING);
  };

  const handleGameOver = useCallback((score: GameScore) => {
    soundManager.stopMenuMusic();
    setFinalScoreData(score);
    if (score.highScore > highScore) {
      setHighScore(score.highScore);
    }
    setCurrentScreen(GameState.GAME_OVER);
  }, [highScore]);

  const handleVictory = useCallback((score: GameScore) => {
    soundManager.stopMenuMusic();
    setFinalScoreData(score);
    if (score.highScore > highScore) {
      setHighScore(score.highScore);
    }
    setCurrentScreen(GameState.VICTORY);
  }, [highScore]);

  // Global Wi-Fi P2P Stage Start Sync (ensures guest aligns map, size, and stage even if canvas unmounted)
  useEffect(() => {
    const unsub = localP2PService.addStageStartListener((stage, map, mode, versusSubMode, mapSize) => {
      soundManager.stopMenuMusic();
      soundManager.unlockAudio();
      setIsWifiCoopOpen(false);
      if (mapSize) {
        setSettings((prev) => (prev.mapSize === mapSize ? prev : { ...prev, mapSize }));
      }
      setCustomMap(map);
      setCurrentStage(stage);
      setMultiplayerConfig((prev) => {
        const effectiveSize = versusSubMode === 'payload' ? 'large' : (mapSize || prev?.mapSize || 'classic');
        return {
          roomCode: prev?.roomCode || localP2PService.getRoomCode(),
          role: prev?.role || 'guest',
          mode: mode || prev?.mode || 'coop',
          versusSubMode: versusSubMode || prev?.versusSubMode || 'classic',
          mapSize: effectiveSize,
          stage,
          slot: prev?.slot || 2,
        };
      });
      setFinalScoreData(null);
      setCurrentScreen(GameState.STAGE_START);
    });
    return unsub;
  }, []);

  const handleNextStage = () => {
    soundManager.stopMenuMusic();
    soundManager.unlockAudio();
    const nextStage = currentStage + 1;
    setCurrentStage(nextStage);
    setFinalScoreData(null);
    setCurrentScreen(GameState.STAGE_START);

    if (multiplayerConfig && multiplayerConfig.roomCode !== 'LOCAL' && multiplayerConfig.role === 'host') {
      const nextMap = customMap || getStageMapForPresetAndStage(
        nextStage,
        effectiveMapSize,
        multiplayerConfig.mode,
        multiplayerConfig.versusSubMode
      );
      localP2PService.sendStageStart(
        nextStage,
        nextMap,
        multiplayerConfig.mode,
        multiplayerConfig.versusSubMode,
        effectiveMapSize
      );
    }
  };

  const handleRetryStage = () => {
    soundManager.stopMenuMusic();
    soundManager.unlockAudio();
    setFinalScoreData(null);
    setCurrentScreen(GameState.STAGE_START);

    if (multiplayerConfig && multiplayerConfig.roomCode !== 'LOCAL' && multiplayerConfig.role === 'host') {
      localP2PService.sendStageStart(
        currentStage,
        currentActiveMap,
        multiplayerConfig.mode,
        multiplayerConfig.versusSubMode,
        effectiveMapSize
      );
    }
  };

  const handleReturnToMenu = () => {
    soundManager.unlockAudio();
    setFinalScoreData(null);
    setMultiplayerConfig(undefined);
    setEditorInitialMap(undefined);
    setCurrentScreen(GameState.MENU);
  };

  const handleStartLocal2Player = (
    mode: 'coop' | 'versus',
    subMode: 'classic' | 'payload' = 'classic',
    stageOverride?: number
  ) => {
    analyticsService.track('play_game');
    soundManager.stopMenuMusic();
    soundManager.unlockAudio();
    const stg = stageOverride ?? currentStage ?? 1;
    const effectiveSize = subMode === 'payload' ? 'large' : settings.mapSize;
    setMultiplayerConfig({
      roomCode: 'LOCAL',
      role: 'host',
      mode,
      versusSubMode: subMode,
      mapSize: effectiveSize,
      stage: stg,
    });
    setCustomMap(undefined);
    setCurrentStage(stg);
    setCurrentScreen(GameState.STAGE_START);
  };

  const handleStartWifiCoop = (config: {
    roomCode: string;
    role: 'host' | 'guest';
    mode: 'coop' | 'versus';
    versusSubMode?: 'classic' | 'payload';
    mapSize?: 'classic' | 'large' | 'giant';
    stage?: number;
    customMap?: StageMap;
  }) => {
    analyticsService.track('play_game');
    soundManager.stopMenuMusic();
    soundManager.unlockAudio();
    setIsWifiCoopOpen(false);
    const effectiveSize = config.versusSubMode === 'payload' ? 'large' : (config.mapSize || settings.mapSize);
    const stg = config.stage || 1;
    setMultiplayerConfig({
      roomCode: config.roomCode,
      role: config.role,
      mode: config.mode,
      versusSubMode: config.versusSubMode || 'classic',
      mapSize: effectiveSize,
      stage: stg,
      slot: config.role === 'host' ? 1 : 2,
    });
    setCustomMap(config.customMap);
    setCurrentStage(stg);
    setFinalScoreData(null);
    setCurrentScreen(GameState.STAGE_START);
  };

  // Active map based on preset or custom.
  // Multiplayer rooms use the room's mapSize; 8-Player FFA & Payload strictly enforce large (34x34).
  const effectiveMapSize = useMemo(() => {
    return multiplayerConfig
      ? (multiplayerConfig.versusSubMode === 'payload'
          ? 'large'
          : multiplayerConfig.mode === 'ffa'
          ? (multiplayerConfig.mapSize === 'classic' ? 'large' : multiplayerConfig.mapSize)
          : multiplayerConfig.mapSize)
      : settings.mapSize;
  }, [multiplayerConfig?.versusSubMode, multiplayerConfig?.mode, multiplayerConfig?.mapSize, settings.mapSize]);

  const currentActiveMap = useMemo(() => {
    return (
      customMap ||
      getStageMapForPresetAndStage(
        currentStage,
        effectiveMapSize,
        multiplayerConfig?.mode,
        multiplayerConfig?.versusSubMode
      )
    );
  }, [
    customMap,
    currentStage,
    effectiveMapSize,
    multiplayerConfig?.mode,
    multiplayerConfig?.versusSubMode,
  ]);

  return (
    <div
      className={`min-h-screen bg-black text-white flex flex-col items-center justify-center selection:bg-amber-500 selection:text-black ${
        currentScreen === GameState.MENU
          ? 'p-0 overflow-hidden w-full h-screen'
          : settings.windowScale === 'max'
          ? 'p-0.5 sm:p-1.5'
          : 'p-2 sm:p-4'
      }`}
    >

      {/* Gamepad Connected Flash Notification */}
      {gamepadAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-emerald-700 border-2 border-emerald-400 text-white font-pixel text-[9px] px-3 py-1.5 rounded shadow-xl z-50 animate-bounce">
          {gamepadAlert}
        </div>
      )}

      {/* Screen Router */}
      <main className={`w-full flex items-center justify-center ${currentScreen === GameState.MENU ? 'h-full' : ''}`}>
        {currentScreen === GameState.MENU ? (
          <ArcadeCabinetFrame>
            <TitleScreen
              highScore={highScore}
              mapSizeLabel={MAP_SIZE_CONFIGS[settings.mapSize]?.label}
              onStart1Player={handleStartGame}
              onStartLocal2Player={handleStartLocal2Player}
              onOpenWifiCoop={() => setIsWifiCoopOpen(true)}
              onOpenConstruction={handleOpenConstruction}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenStats={() => setShowSecretStats(true)}
              inCabinet={true}
              disabled={isSettingsOpen || isWifiCoopOpen || showSecretStats}
            />
          </ArcadeCabinetFrame>
        ) : currentScreen === GameState.STAGE_START ? (
          <StageIntro
            stage={currentStage}
            onSelectStage={(stg) => setCurrentStage(stg)}
            onComplete={handleStageIntroComplete}
          />
        ) : currentScreen === GameState.PLAYING || currentScreen === GameState.PAUSED ? (
          <GameCanvas
            currentStage={currentStage}
            customMap={currentActiveMap}
            settings={settings}
            multiplayerConfig={multiplayerConfig}
            onGameOver={handleGameOver}
            onVictory={handleVictory}
            onOpenEditor={handleOpenConstruction}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onReturnToMenu={handleReturnToMenu}
            onUpdateSettings={handleUpdateSettings}
            isSettingsOpen={isSettingsOpen}
          />
        ) : currentScreen === GameState.BUILDING ? (
          <MapEditorToolbar
            initialMap={editorInitialMap || customMap || getStageMapForPresetAndStage(1, settings.mapSize)}
            onStartBattle={handlePlayCustomMap}
            onCancel={handleReturnToMenu}
          />
        ) : (currentScreen === GameState.GAME_OVER || currentScreen === GameState.VICTORY) && finalScoreData ? (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
            <GameOverModal
              isVictory={currentScreen === GameState.VICTORY}
              scoreData={finalScoreData}
              onNextStage={currentScreen === GameState.VICTORY ? handleNextStage : undefined}
              onRetry={handleRetryStage}
              onReturnToMenu={handleReturnToMenu}
              isGuest={multiplayerConfig?.role === 'guest' && multiplayerConfig.roomCode !== 'LOCAL'}
            />
          </div>
        ) : null}
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onClose={() => setIsSettingsOpen(false)}
          onExitMatch={
            currentScreen === GameState.PLAYING || currentScreen === GameState.PAUSED
              ? () => {
                  setIsSettingsOpen(false);
                  handleReturnToMenu();
                }
              : undefined
          }
        />
      )}

      {/* Local Wi-Fi Co-Op / Cross-Play Modal */}
      {isWifiCoopOpen && (
        <WifiCoopModal
          onClose={() => setIsWifiCoopOpen(false)}
          onStartBattle={handleStartWifiCoop}
          currentStage={currentStage}
          mapSize={effectiveMapSize}
          customMap={customMap}
        />
      )}

      {/* Secret Analytics Stats Modal */}
      {showSecretStats && (
        <SecretStatsModal onClose={() => setShowSecretStats(false)} />
      )}
    </div>
  );
}

