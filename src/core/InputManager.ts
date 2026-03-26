export class InputManager {
    keys: Record<string, boolean> = {};
    movementX = 0;
    movementY = 0;
    isLocked = false;
    isMouseDown = false;
    justPressed = false;

    constructor() {
        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);
        window.addEventListener('mousemove', (e) => {
            if (this.isLocked) {
                this.movementX += e.movementX;
                this.movementY += e.movementY;
            }
        });
        window.addEventListener('mousedown', (e) => {
            if (e.button === 0 && this.isLocked) {
                this.isMouseDown = true;
                this.justPressed = true;
            }
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.isMouseDown = false;
        });
        document.addEventListener('pointerlockchange', () => {
            this.isLocked = document.pointerLockElement !== null;
        });
    }

    consumeMovement() {
        const mx = this.movementX;
        const my = this.movementY;
        this.movementX = 0;
        this.movementY = 0;
        return { mx, my };
    }

    consumeClick() {
        const clicked = this.justPressed;
        this.justPressed = false;
        return clicked;
    }
    
    consumeKey(code: string) {
        if (this.keys[code]) {
            this.keys[code] = false;
            return true;
        }
        return false;
    }
}
