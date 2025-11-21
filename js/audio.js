import * as THREE from 'three';

export class AudioManager {
    constructor(camera) {
        this.listener = new THREE.AudioListener();
        camera.add(this.listener);

        this.loader = new THREE.AudioLoader();
        this.sounds = {}; 

        // CANAL EXCLUSIVO PARA PASSOS
        this.footstepSound = new THREE.Audio(this.listener);

        // CANAL OTIMIZADO PARA IMPACTOS (Pool)
        // Criamos 3 objetos de áudio prontos para usar. 
        // Isso remove o "lag" de criar new Audio() na hora da martelada.
        this.impactPool = [];
        for(let i=0; i<3; i++) this.impactPool.push(new THREE.Audio(this.listener));
        this.impactIndex = 0;

        // Variáveis de controle
        this.stepTimer = 0;
        this.stepIntervalWalk = 0.5;
        this.stepIntervalRun = 0.3;
        this.wasMoving = false; // Para detectar o "início" do movimento
    }

    load() {
        const soundFiles = {
            'ambient': 'assets/sounds/ambient.mp3',
            'step': 'assets/sounds/step.mp3',
            'impact': 'assets/sounds/hammer_hit.mp3',
            'break': 'assets/sounds/wall_break.mp3'
        };

        for (const [name, path] of Object.entries(soundFiles)) {
            this.loader.load(
                path,
                (buffer) => {
                    this.sounds[name] = buffer;
                    
                    if(name === 'ambient') this._playAmbient();
                    
                    if(name === 'step') {
                        this.footstepSound.setBuffer(buffer);
                        this.footstepSound.setLoop(false);
                        this.footstepSound.setVolume(0.4);
                    }
                },
                undefined,
                (err) => console.warn(`Erro ao carregar: ${path}`, err)
            );
        }
    }

    // Toca efeitos sonoros gerais com performance máxima
    play(name, volume = 1.0, pitch = 1.0) {
        if (!this.sounds[name]) return;
        if (name === 'step') return; 

        let sound;

        // Se for som de impacto ou quebra, usa o Pool pré-carregado
        if (name === 'impact' || name === 'break') {
            sound = this.impactPool[this.impactIndex];
            this.impactIndex = (this.impactIndex + 1) % this.impactPool.length;
            
            // Se o som do pool estiver tocando, para ele para reiniciar instantaneamente
            if(sound.isPlaying) sound.stop();
        } else {
            // Para outros sons (woosh, etc), cria normal
            sound = new THREE.Audio(this.listener);
        }

        sound.setBuffer(this.sounds[name]);
        sound.setVolume(volume);
        
        if (pitch !== 1.0) sound.setPlaybackRate(pitch);
        
        // Variação aleatória leve no pitch para não ficar robótico
        if (sound.source && sound.source.detune) {
             sound.setDetune((Math.random() - 0.5) * 100); 
        }

        sound.play();
    }

    updateSteps(isMoving, isRunning, delta) {
        // 1. SE O JOGADOR PAROU
        if (!isMoving) {
            if (this.footstepSound.isPlaying) {
                this.footstepSound.stop(); // Corta o som imediatamente
            }
            this.wasMoving = false;
            return;
        }

        // 2. DETECTA O "PRIMEIRO PASSO" (Start Instantâneo)
        if (!this.wasMoving) {
            // O jogador estava parado e começou agora. Toca JÁ!
            this._triggerStep(isRunning);
            this.stepTimer = 0; // Reseta o timer
            this.wasMoving = true;
            return;
        }

        // 3. LOOP DE PASSOS SEGUINTES
        this.stepTimer += delta;
        const interval = isRunning ? this.stepIntervalRun : this.stepIntervalWalk;

        if (this.stepTimer >= interval) {
            this._triggerStep(isRunning);
            this.stepTimer = 0;
        }
    }

    _triggerStep(isRunning) {
        if (!this.footstepSound.buffer) return;

        if (this.footstepSound.isPlaying) this.footstepSound.stop();

        const vol = isRunning ? 0.6 : 0.4;
        const pitch = isRunning ? 1.3 : 1.0;

        this.footstepSound.setVolume(vol);
        this.footstepSound.setPlaybackRate(pitch);
        
        if (this.footstepSound.source && this.footstepSound.source.detune) {
             this.footstepSound.setDetune((Math.random() - 0.5) * 100);
        }

        this.footstepSound.play();
    }

    _playAmbient() {
        if (!this.sounds['ambient']) return;
        if (this.listener.context.state === 'suspended') this.listener.context.resume();

        const bgm = new THREE.Audio(this.listener);
        bgm.setBuffer(this.sounds['ambient']);
        bgm.setLoop(true);
        bgm.setVolume(0.4);
        bgm.play();
    }

    getBuffer(name) {
        return this.sounds[name];
    }

    reset() {
        // Para passos
        if (this.footstepSound.isPlaying) {
            this.footstepSound.stop();
        }
        this.wasMoving = false;
        this.stepTimer = 0;

        // Para impactos (opcional, mas bom garantir)
        this.impactPool.forEach(sound => {
            if(sound.isPlaying) sound.stop();
        });
    }

    togglePause(isPaused) {
        if(isPaused) {
            this.listener.setMasterVolume(0);
        } else {
            this.listener.setMasterVolume(1);
        }
    }

    stopAll() {
        // Para tudo, inclusive ambiente
        if (this.footstepSound.isPlaying) this.footstepSound.stop();
        
        this.impactPool.forEach(sound => {
            if(sound.isPlaying) sound.stop();
        });

        // Opcional: Parar ambiente também se quiser silêncio total no Game Over
        // Mas geralmente queremos manter a música de fundo ou trocá-la.
        // O usuário pediu para parar "os sons", vou parar tudo por segurança.
        // Se tiver música de menu, teria que tratar separado.
        // Como o ambient.mp3 é meio "assustador", talvez seja bom parar.
        // Vou parar tudo.
        this.listener.setMasterVolume(0); 
    }
}