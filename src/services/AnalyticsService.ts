/**
 * Battle City 1990 - Silent Analytics & Telemetry Service
 * Discreetly records visits, unique players, downloads (APK/EXE), and gameplay sessions.
 * Sends lightweight beacon events to the VPS backend with zero impact on game performance.
 */

const API_ENDPOINT = 'https://api-tank.nosfir.online/api/track';
const STATS_ENDPOINT = 'https://api-tank.nosfir.online/api/stats';

export type AnalyticsEvent = 'visit' | 'download_apk' | 'download_exe' | 'play_game';

export interface StatsData {
  totalVisits: number;
  uniqueVisitors: number;
  apkDownloads: number;
  exeDownloads: number;
  gamesPlayed: number;
  lastUpdated: string;
  today?: {
    date: string;
    visits: number;
    apk: number;
    exe: number;
    plays: number;
  };
}

class AnalyticsService {
  private clientId: string = '';
  private initialized: boolean = false;

  constructor() {
    this.initClientId();
  }

  private initClientId(): void {
    if (typeof window === 'undefined') return;
    try {
      let id = localStorage.getItem('tank_client_id');
      if (!id) {
        id = 'tc_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
        localStorage.setItem('tank_client_id', id);
      }
      this.clientId = id;
    } catch {
      this.clientId = 'tc_anonymous';
    }
  }

  /**
   * Track visit once per session to avoid counting page reloads multiple times
   */
  public trackVisit(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    try {
      const visitedThisSession = sessionStorage.getItem('tank_session_visited');
      if (!visitedThisSession) {
        sessionStorage.setItem('tank_session_visited', 'true');
        this.sendEvent('visit');
      }
    } catch {
      this.sendEvent('visit');
    }
  }

  /**
   * Track specific user action (e.g. download_apk, download_exe, play_game)
   */
  public track(event: AnalyticsEvent): void {
    this.sendEvent(event);
  }

  /**
   * Dispatches beacon / fetch event to backend in background
   */
  private sendEvent(event: AnalyticsEvent): void {
    if (typeof window === 'undefined') return;

    const payload = JSON.stringify({
      event,
      clientId: this.clientId,
      timestamp: new Date().toISOString(),
      platform: typeof navigator !== 'undefined' ? (navigator.userAgent.includes('Android') ? 'android' : 'desktop') : 'unknown',
    });

    try {
      fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
        mode: 'cors',
      }).catch(() => {
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          navigator.sendBeacon(API_ENDPOINT, payload);
        }
      });
    } catch {
      try {
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          navigator.sendBeacon(API_ENDPOINT, payload);
        }
      } catch {}
    }
  }

  /**
   * Fetch current stats for the secret dashboard
   */
  public async fetchStats(): Promise<StatsData | null> {
    try {
      const res = await fetch(STATS_ENDPOINT, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
}

export const analyticsService = new AnalyticsService();
