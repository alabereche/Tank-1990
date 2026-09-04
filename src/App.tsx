/**
 * Battle City 1990 - React 18+ Main Application
 * Coordinates Screen Management: Title Menu, Construction Editor,
 * Stage Curtain Intro, 60 FPS Canvas Battle, and Victory / Game Over Score Screens.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { GameState, GameScore, StageMap, GameSettings, MultiplayerMode, MultiplayerRole } from './types';
import { TitleScreen } from './components/TitleScreen';
import { GameCanvas } from './components/GameCanvas';
import { MapEditorToolbar } from './components/MapEditorToolbar';
import { StageIntro } from './components/StageIntro';
import { GameOverModal } from './components/GameOverModal';
import { SettingsModal } from './components/SettingsModal';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { PRESET_MAPS, getStageMapForPresetAndStage, MAP_SIZE_CONFIGS } from './engine/maps';
import { soundManager } from './engine/SoundManager';
import { gamepadManager, GamepadInfo } from './engine/GamepadManager';
import { toggleFullscreen } from './utils/fullscreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<GameState>(GameState.MENU);
  const [currentStage, setCurrentStage] = useState<number>(1);
  const [customMap, setCustomMap] = useState<StageMap | undefined>(undefined);
  const [finalScoreData, setFinalScoreData] = useState<GameScore | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isMultiplayerLobbyOpen, setIsMultiplayerLobbyOpen] = useState<boolean>(false);
  const [multiplayerConfig, setMultiplayerConfig] = useState<{
    roomCode: string;
    role: MultiplayerRole;
    mode: MultiplayerMode;
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
    try {
      const saved = localStorage.getItem('battle_city_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          mapSize: parsed.mapSize || 'classic',
          playerSpeed: 1.1,
          showScanlines: parsed.showScanlines !== false,
          soundEnabled: parsed.soundEnabled !== false,
          windowScale: parsed.windowScale || 'large',
        };
      }
    } catch {}
    return {
      mapSize: 'classic',
      playerSpeed: 1.1,
      showScanlines: true,
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
        setGamepadAlert(`🎮 Gamepad Detected: ${gp.id.split('(')[0]}`);
        setTimeout(() => setGamepadAlert(null), 4000);
      }
    });

    const current = gamepadManager.getConnectedGamepad();
    if (current) setConnectedGamepad(current);

    return unsub;
  }, []);

  // Global keydown handler for Fullscreen
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  const handleUpdateSettings = (newSettings: GameSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('battle_city_settings', JSON.stringify(newSettings));
    } catch {}
  };

  // Handlers for Transitions
  const handleStartGame = () => {
    soundManager.unlockAudio();
    setCurrentStage(1);
    setCustomMap(undefined);
    setCurrentScreen(GameState.STAGE_START);
  };

  const handleOpenConstruction = () => {
    soundManager.unlockAudio();
    setCurrentScreen(GameState.BUILDING);
  };

  const handlePlayCustomMap = (map: StageMap) => {
    soundManager.unlockAudio();
    setCustomMap(map);
    setCurrentStage(1);
    setCurrentScreen(GameState.STAGE_START);
  };

  const handleStageIntroComplete = () => {
    setCurrentScreen(GameState.PLAYING);
  };

  const handleGameOver = useCallback((score: GameScore) => {
    setFinalScoreData(score);
    if (score.highScore > highScore) {
      setHighScore(score.highScore);
    }
    setCurrentScreen(GameState.GAME_OVER);
  }, [highScore]);

  const handleVictory = useCallback((score: GameScore) => {
    setFinalScoreData(score);
    if (score.highScore > highScore) {
      setHighScore(score.highScore);
    }
    setCurrentScreen(GameState.VICTORY);
  }, [highScore]);

  const handleNextStage = () => {
    soundManager.unlockAudio();
    setCurrentStage((prev) => prev + 1);
    setCurrentScreen(GameState.STAGE_START);
  };

  const handleRetryStage = () => {
    soundManager.unlockAudio();
    setCurrentScreen(GameState.STAGE_START);
  };

  const handleReturnToMenu = () => {
    soundManager.unlockAudio();
    setMultiplayerConfig(undefined);
    setIsMultiplayerLobbyOpen(false);
    setCurrentScreen(GameState.MENU);
  };

  const handleStartLocal2Player = (mode: 'coop' | 'versus') => {
    soundManager.unlockAudio();
    setMultiplayerConfig({
      roomCode: 'LOCAL',
      role: 'host',
      mode,
      mapSize: settings.mapSize,
      stage: 1,
    });
    setCustomMap(undefined);
    setCurrentStage(1);
    setCurrentScreen(GameState.STAGE_START);
  };

  const handleStartMultiplayerGame = (config: {
    roomCode: string;
    role: MultiplayerRole;
    mode: MultiplayerMode;
    mapSize: 'classic' | 'large' | 'giant';
    stage: number;
    customMapGrid?: number[][];
    slot?: number;
    team?: 'A' | 'B' | 'FFA';
  }) => {
    soundManager.unlockAudio();
    setMultiplayerConfig(config);
    setCurrentStage(config.stage || 1);
    if (config.customMapGrid) {
      setCustomMap({
        id: `custom_${config.roomCode}`,
        name: `Room ${config.roomCode} Map`,
        grid: config.customMapGrid,
      });
    } else {
      setCustomMap(undefined);
    }
    setIsMultiplayerLobbyOpen(false);
    setCurrentScreen(GameState.PLAYING);
  };

  // Active map based on preset or custom.
  // Multiplayer rooms use the room's mapSize; 8-Player FFA strictly enforces large (34x34) or giant (42x42).
  const effectiveMapSize = multiplayerConfig
    ? (multiplayerConfig.mode === 'ffa'
        ? (multiplayerConfig.mapSize === 'classic' ? 'large' : multiplayerConfig.mapSize)
        : multiplayerConfig.mapSize)
    : settings.mapSize;
  const currentActiveMap = customMap || getStageMapForPresetAndStage(currentStage, effectiveMapSize, multiplayerConfig?.mode);

  return (
    <div
      className={`min-h-screen bg-black text-white flex flex-col items-center justify-center selection:bg-amber-500 selection:text-black ${
        settings.windowScale === 'max' ? 'p-0.5 sm:p-1.5' : 'p-2 sm:p-4'
      }`}
    >
      {/* Gamepad Connected Flash Notification */}
      {gamepadAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-emerald-700 border-2 border-emerald-400 text-white font-pixel text-[9px] px-3 py-1.5 rounded shadow-xl z-50 animate-bounce">
          {gamepadAlert}
        </div>
      )}

      {/* Screen Router */}
      <main className="w-full flex items-center justify-center">
        {isMultiplayerLobbyOpen ? (
          <MultiplayerLobby
            onLaunchGame={handleStartMultiplayerGame}
            onBack={() => setIsMultiplayerLobbyOpen(false)}
          />
        ) : currentScreen === GameState.MENU ? (
          <TitleScreen
            highScore={highScore}
            mapSizeLabel={MAP_SIZE_CONFIGS[settings.mapSize]?.label}
            onStart1Player={handleStartGame}
            onStartLocal2Player={handleStartLocal2Player}
            onOpenMultiplayer={() => setIsMultiplayerLobbyOpen(true)}
            onOpenConstruction={handleOpenConstruction}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        ) : currentScreen === GameState.STAGE_START ? (
          <StageIntro stage={currentStage} onComplete={handleStageIntroComplete} />
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
          />
        ) : currentScreen === GameState.BUILDING ? (
          <MapEditorToolbar
            initialMap={customMap || getStageMapForPresetAndStage(1, settings.mapSize)}
            onStartBattle={handlePlayCustomMap}
            onCancel={handleReturnToMenu}
          />
        ) : (currentScreen === GameState.GAME_OVER || currentScreen === GameState.VICTORY) && finalScoreData ? (
          <GameOverModal
            isVictory={currentScreen === GameState.VICTORY}
            scoreData={finalScoreData}
            onNextStage={currentScreen === GameState.VICTORY ? handleNextStage : undefined}
            onRetry={handleRetryStage}
            onReturnToMenu={handleReturnToMenu}
          />
        ) : null}
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
}

