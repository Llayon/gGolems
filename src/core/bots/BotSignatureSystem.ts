import type { BotIntent } from '../../entities/DummyBot';

export type BotSignatureContext = {
    intent: BotIntent;
    hpRatio: number;
    hasEngageTarget: boolean;
    cooldownRemaining: number;
};

export type BotSignatureDecision = {
    shouldActivate: boolean;
};

export function decideBotSignature(context: BotSignatureContext): BotSignatureDecision {
    if (context.cooldownRemaining > 0) return { shouldActivate: false };
    if (!context.hasEngageTarget) return { shouldActivate: false };

    if (context.intent === 'retreat' && context.hpRatio < 0.4) {
        return { shouldActivate: true };
    }
    if (context.intent === 'contest' && context.hpRatio > 0.5) {
        return { shouldActivate: true };
    }
    if (context.intent === 'hold' && context.hpRatio < 0.6) {
        return { shouldActivate: true };
    }
    return { shouldActivate: false };
}