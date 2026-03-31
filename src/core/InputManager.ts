type VirtualAction =
    | 'fireGroup1'
    | 'fireGroup2'
    | 'fireGroup3'
    | 'alphaStrike'
    | 'dash'
    | 'vent'
    | 'centerTorso'
    | 'stopThrottle';

export class InputManager {
    keys: Record<string, boolean> = {};
    movementX = 0;
    movementY = 0;
    isLocked = false;
    justPressedPrimary = false;
    justPressedSecondary = false;
    virtualThrottle = 0;
    virtualTurn = 0;
    virtualActions: Record<VirtualAction, boolean> = {
        fireGroup1: false,
        fireGroup2: false,
        fireGroup3: false,
        alphaStrike: false,
        dash: false,
        vent: false,
        centerTorso: false,
        stopThrottle: false
    };
    onKeyDown = (e: KeyboardEvent) => {
        this.keys[e.code] = true;
    };
    onKeyUp = (e: KeyboardEvent) => {
        this.keys[e.code] = false;
    };
    onMouseMove = (e: MouseEvent) => {
        if (this.isLocked) {
            this.movementX += e.movementX;
            this.movementY += e.movementY;
        }
    };
    onMouseDown = (e: MouseEvent) => {
        if (!this.isLocked) return;
        if (e.button === 0) {
            this.justPressedPrimary = true;
        } else if (e.button === 2) {
            this.justPressedSecondary = true;
        }
    };
    onContextMenu = (e: MouseEvent) => {
        if (this.isLocked) {
            e.preventDefault();
        }
    };
    onPointerLockChange = () => {
        this.isLocked = document.pointerLockElement !== null;
    };

    constructor() {
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('contextmenu', this.onContextMenu);
        document.addEventListener('pointerlockchange', this.onPointerLockChange);
    }

    dispose() {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('contextmenu', this.onContextMenu);
        document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    }

    consumeMovement() {
        const mx = this.movementX;
        const my = this.movementY;
        this.movementX = 0;
        this.movementY = 0;
        return { mx, my };
    }

    consumeFireGroup(group: 1 | 2 | 3) {
        if (group === 1) {
            const active = this.justPressedPrimary || this.virtualActions.fireGroup1;
            this.justPressedPrimary = false;
            this.virtualActions.fireGroup1 = false;
            return active;
        }
        if (group === 2) {
            const active = this.justPressedSecondary || this.virtualActions.fireGroup2;
            this.justPressedSecondary = false;
            this.virtualActions.fireGroup2 = false;
            return active;
        }

        const active = this.virtualActions.fireGroup3;
        this.virtualActions.fireGroup3 = false;
        return active;
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

    consumeVirtualAction(action: Exclude<VirtualAction, 'fireGroup1' | 'fireGroup2' | 'fireGroup3'>) {
        const active = this.virtualActions[action];
        this.virtualActions[action] = false;
        return active;
    }
}
