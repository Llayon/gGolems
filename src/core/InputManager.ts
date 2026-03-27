type VirtualAction = 'fire' | 'dash' | 'vent' | 'centerTorso' | 'stopThrottle';

export class InputManager {
    keys: Record<string, boolean> = {};
    movementX = 0;
    movementY = 0;
    isLocked = false;
    isMouseDown = false;
    justPressed = false;
    virtualThrottle = 0;
    virtualTurn = 0;
    virtualActions: Record<VirtualAction, boolean> = {
        fire: false,
        dash: false,
        vent: false,
        centerTorso: false,
        stopThrottle: false
    };

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
        const clicked = this.justPressed || this.virtualActions.fire;
        this.justPressed = false;
        this.virtualActions.fire = false;
        return clicked;
    }
    
    consumeKey(code: string) {
        if (this.keys[code]) {
            this.keys[code] = false;
            return true;
        }
        return false;
    }

    setVirtualAxes(throttle: number, turn: number) {
        this.virtualThrottle = Math.max(-1, Math.min(1, throttle));
        this.virtualTurn = Math.max(-1, Math.min(1, turn));
    }

    addVirtualLook(dx: number, dy: number) {
        this.movementX += dx;
        this.movementY += dy;
    }

    triggerVirtualAction(action: VirtualAction) {
        this.virtualActions[action] = true;
    }

    consumeVirtualAction(action: Exclude<VirtualAction, 'fire'>) {
        const active = this.virtualActions[action];
        this.virtualActions[action] = false;
        return active;
    }
}
