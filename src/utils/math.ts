export function angleDiff(from: number, to: number): number {
    let diff = to - from;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
}

export function moveTowardsAngle(current: number, target: number, maxStep: number): number {
    const diff = angleDiff(current, target);
    if (Math.abs(diff) <= maxStep) return target;
    return current + Math.sign(diff) * maxStep;
}

export function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
}
