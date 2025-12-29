/**
 * Sound Manager
 * Manages all game sound effects using Web Audio API
 */

export type SoundType =
    // Weapon sounds
    | 'pistol_shot' | 'rifle_shot' | 'shotgun_shot' | 'smg_shot' | 'sniper_shot'
    | 'reload_start' | 'reload_end' | 'weapon_switch'
    // Player sounds
    | 'player_hurt' | 'player_death' | 'player_respawn' | 'player_footstep'
    // Enemy sounds
    | 'enemy_hurt' | 'enemy_death' | 'enemy_footstep'
    // Item sounds
    | 'item_pickup'
    // UI sounds
    | 'ui_click' | 'wave_start';

export class SoundManager {
    private static instance: SoundManager;
    private audioContext: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private volume: number = 0.5;

    private constructor() {
        // Initialize on first user interaction
    }

    static getInstance(): SoundManager {
        if (!SoundManager.instance) {
            SoundManager.instance = new SoundManager();
        }
        return SoundManager.instance;
    }

    /**
     * Initialize audio context (must be called after user interaction)
     */
    initialize(): void {
        if (this.audioContext) return;

        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = this.volume;
            this.masterGain.connect(this.audioContext.destination);
            console.log('[SoundManager] Initialized');
        } catch (e) {
            console.warn('[SoundManager] Web Audio API not supported:', e);
        }
    }

    /**
     * Play a sound effect
     */
    play(type: SoundType): void {
        if (!this.audioContext || !this.masterGain) return;

        // Resume context if suspended (browser autoplay policy)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        switch (type) {
            // Weapon sounds
            case 'pistol_shot':
                this.playPistolShot();
                break;
            case 'rifle_shot':
                this.playRifleShot();
                break;
            case 'shotgun_shot':
                this.playShotgunShot();
                break;
            case 'smg_shot':
                this.playSMGShot();
                break;
            case 'sniper_shot':
                this.playSniperShot();
                break;
            case 'reload_start':
                this.playReloadStart();
                break;
            case 'reload_end':
                this.playReloadEnd();
                break;
            case 'weapon_switch':
                this.playWeaponSwitch();
                break;

            // Player sounds
            case 'player_hurt':
                this.playPlayerHurt();
                break;
            case 'player_death':
                this.playPlayerDeath();
                break;
            case 'player_respawn':
                this.playPlayerRespawn();
                break;
            case 'player_footstep':
                this.playPlayerFootstep();
                break;

            // Enemy sounds
            case 'enemy_hurt':
                this.playEnemyHurt();
                break;
            case 'enemy_death':
                this.playEnemyDeath();
                break;
            case 'enemy_footstep':
                this.playEnemyFootstep();
                break;

            // Item sounds
            case 'item_pickup':
                this.playItemPickup();
                break;

            // UI sounds
            case 'ui_click':
                this.playUIClick();
                break;
            case 'wave_start':
                this.playWaveStart();
                break;
        }
    }

    /**
     * Set master volume
     */
    setVolume(volume: number): void {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.masterGain) {
            this.masterGain.gain.value = this.volume;
        }
    }

    /**
     * Get master volume
     */
    getVolume(): number {
        return this.volume;
    }

    // ==================== Sound Generators ====================

    private playPistolShot(): void {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;

        // 主要枪声 - 使用噪声
        const noiseBuffer = this.createNoiseBuffer(0.15);
        const noise = this.audioContext.createBufferSource();
        noise.buffer = noiseBuffer;

        const noiseFilter = this.audioContext.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(2000, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 0.15);

        const noiseGain = this.audioContext.createGain();
        noiseGain.gain.setValueAtTime(0.5, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        // 低频冲击
        const osc = this.audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.1);

        const oscGain = this.audioContext.createGain();
        oscGain.gain.setValueAtTime(0.4, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        // 连接噪声
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        // 连接低频
        osc.connect(oscGain);
        oscGain.connect(this.masterGain);

        noise.start(now);
        osc.start(now);
        noise.stop(now + 0.15);
        osc.stop(now + 0.1);
    }

    private playRifleShot(): void {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;

        // 更有力的枪声
        const noiseBuffer = this.createNoiseBuffer(0.12);
        const noise = this.audioContext.createBufferSource();
        noise.buffer = noiseBuffer;

        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1500, now);
        filter.frequency.exponentialRampToValueAtTime(300, now + 0.12);
        filter.Q.value = 2;

        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

        // 低频冲击
        const osc = this.audioContext.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

        const oscGain = this.audioContext.createGain();
        oscGain.gain.setValueAtTime(0.35, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.connect(oscGain);
        oscGain.connect(this.masterGain);

        noise.start(now);
        osc.start(now);
        noise.stop(now + 0.12);
        osc.stop(now + 0.08);
    }

    private playShotgunShot(): void {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;

        // 多层噪声形成爆炸感
        for (let i = 0; i < 6; i++) {
            const noiseBuffer = this.createNoiseBuffer(0.25);
            const noise = this.audioContext.createBufferSource();
            noise.buffer = noiseBuffer;

            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            const baseFreq = 800 + Math.random() * 400;
            filter.frequency.setValueAtTime(baseFreq, now);
            filter.frequency.exponentialRampToValueAtTime(100, now + 0.25);

            const gain = this.audioContext.createGain();
            gain.gain.setValueAtTime(0.2 + Math.random() * 0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            const offset = Math.random() * 0.01;
            noise.start(now + offset);
            noise.stop(now + offset + 0.25);
        }

        // 强烈低频冲击
        const osc = this.audioContext.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.3);

        const oscGain = this.audioContext.createGain();
        oscGain.gain.setValueAtTime(0.5, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc.connect(oscGain);
        oscGain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.3);
    }

    private playSMGShot(): void {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;

        // 快速、高频枪声
        const noiseBuffer = this.createNoiseBuffer(0.06);
        const noise = this.audioContext.createBufferSource();
        noise.buffer = noiseBuffer;

        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1200, now);
        filter.frequency.exponentialRampToValueAtTime(400, now + 0.06);

        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

        // 轻微低频
        const osc = this.audioContext.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.05);

        const oscGain = this.audioContext.createGain();
        oscGain.gain.setValueAtTime(0.15, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.connect(oscGain);
        oscGain.connect(this.masterGain);

        noise.start(now);
        osc.start(now);
        noise.stop(now + 0.06);
        osc.stop(now + 0.05);
    }

    private playSniperShot(): void {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;

        // 长响尾音
        const noiseBuffer = this.createNoiseBuffer(0.8);
        const noise = this.audioContext.createBufferSource();
        noise.buffer = noiseBuffer;

        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2500, now);
        filter.frequency.exponentialRampToValueAtTime(150, now + 0.8);
        filter.Q.value = 3;

        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

        // 强烈低频
        const osc = this.audioContext.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(60, now);
        osc.frequency.exponentialRampToValueAtTime(15, now + 0.6);

        const oscGain = this.audioContext.createGain();
        oscGain.gain.setValueAtTime(0.5, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.connect(oscGain);
        oscGain.connect(this.masterGain);

        noise.start(now);
        osc.start(now);
        noise.stop(now + 0.8);
        osc.stop(now + 0.6);
    }

    private playReloadStart(): void {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.setValueAtTime(600, now + 0.1);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.1);
    }

    private playReloadEnd(): void {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.setValueAtTime(800, now + 0.1);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.1);
    }

    private playWeaponSwitch(): void {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(600, now + 0.05);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.05);
    }

    private playPlayerHurt(): void {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.2);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.2);
    }

    private playPlayerDeath(): void {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 1);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 1);
    }

    private playPlayerRespawn(): void {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.3);
    }

    private playEnemyHurt(): void {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.linearRampToValueAtTime(150, now + 0.1);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.1);
    }

    private playEnemyDeath(): void {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.4);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.4);
    }

    private playItemPickup(): void {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    private playUIClick(): void {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.03);
    }

    private playWaveStart(): void {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;

        // Play two tones
        for (let i = 0; i < 2; i++) {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(500 + i * 100, now + i * 0.2);

            gain.gain.setValueAtTime(0, now + i * 0.2);
            gain.gain.linearRampToValueAtTime(0.15, now + i * 0.2 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.3);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(now + i * 0.2);
            osc.stop(now + i * 0.2 + 0.3);
        }
    }

    // ==================== Footstep Sounds ====================

    private playPlayerFootstep(): void {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;

        // 使用噪声模拟脚步声
        const bufferSize = this.audioContext.sampleRate * 0.1; // 0.1秒
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        // 生成白噪声
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;

        // 带通滤波器模拟脚步频率
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(400, now);
        filter.Q.value = 1;

        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(now);
        noise.stop(now + 0.1);
    }

    private playEnemyFootstep(): void {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;

        // 敌人脚步声更低沉
        const bufferSize = this.audioContext.sampleRate * 0.08;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;

        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(250, now);
        filter.Q.value = 2;

        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(now);
        noise.stop(now + 0.08);
    }

    // ==================== Improved Gun Sounds ====================

    private createNoiseBuffer(duration: number): AudioBuffer {
        const bufferSize = this.audioContext!.sampleRate * duration;
        const buffer = this.audioContext!.createBuffer(1, bufferSize, this.audioContext!.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        return buffer;
    }

    private createEcho(delay: number, decay: number): AudioNode {
        if (!this.audioContext || !this.masterGain) {
            throw new Error('AudioContext not initialized');
        }

        const now = this.audioContext.currentTime;
        const delayNode = this.audioContext.createDelay(delay);
        const feedback = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();

        delayNode.delayTime.value = delay;
        feedback.gain.value = decay;
        filter.type = 'lowpass';
        filter.frequency.value = 1000;

        delayNode.connect(feedback);
        feedback.connect(filter);
        filter.connect(delayNode);

        return delayNode;
    }
}
