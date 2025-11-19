export class InputManager {
    constructor() {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            sprint: false
        };
        
        this.isHammerPressed = false; 

        this.callbacks = {};
        this._initListeners();
    }

    on(action, callback) {
        this.callbacks[action] = callback;
    }

    // NOVO MÉTODO: Chamado pelo main.js ao reiniciar o jogo
    reset() {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            sprint: false
        };
        this.isHammerPressed = false;
    }

    _initListeners() {
        document.addEventListener('keydown', (e) => this._onKey(e, true));
        document.addEventListener('keyup', (e) => this._onKey(e, false));
        
        document.addEventListener('mousedown', (e) => {
            if(e.button === 0) {
                this.isHammerPressed = true;
                if(this.callbacks['attack']) this.callbacks['attack']();
            }
        });
    }

    _onKey(event, isDown) {
        const code = event.code;
        switch(code) {
            case 'KeyW': this.keys.forward = isDown; break;
            case 'KeyS': this.keys.backward = isDown; break;
            case 'KeyA': this.keys.left = isDown; break;
            case 'KeyD': this.keys.right = isDown; break;
            case 'ShiftLeft': this.keys.sprint = isDown; break;
            
            case 'Space': this.isHammerPressed = isDown; break;

            case 'KeyE': if(isDown && this.callbacks['interact']) this.callbacks['interact'](); break;
            case 'Digit1': if(isDown && this.callbacks['use1']) this.callbacks['use1'](); break;
            case 'Digit2': if(isDown && this.callbacks['use2']) this.callbacks['use2'](); break;
            case 'Digit3': if(isDown && this.callbacks['use3']) this.callbacks['use3'](); break;
        }
    }

    getMovementState() {
        return this.keys;
    }
}