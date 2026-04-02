import { CombatOverlayCore } from '../mobile/CombatOverlayCore';
import { CockpitFrame, TorsoTwistArc } from './desktopHudPrimitives';
import { buildDesktopHudViewModel } from './buildDesktopHudViewModel';
import { DesktopBottomHud } from './DesktopBottomHud';
import { DesktopHostBadge } from './DesktopHostBadge';
import { DesktopPilotPanel } from './DesktopPilotPanel';
import { DesktopSettingsOverlay } from './DesktopSettingsOverlay';
import type { DesktopCombatHudProps } from './desktopHudTypes';

export function DesktopCombatHud(props: DesktopCombatHudProps) {
    const viewModel = buildDesktopHudViewModel(props);

    return (
        <>
            {viewModel.cockpitFrame ? (
                <CockpitFrame
                    warning={viewModel.cockpitFrame.warning}
                    throttleLabel={viewModel.cockpitFrame.throttleLabel}
                    kickX={viewModel.cockpitFrame.kickX}
                    kickY={viewModel.cockpitFrame.kickY}
                    kickRoll={viewModel.cockpitFrame.kickRoll}
                    frameKick={viewModel.cockpitFrame.frameKick}
                    flash={viewModel.cockpitFrame.flash}
                />
            ) : null}

            {viewModel.hostBadge ? (
                <DesktopHostBadge
                    viewModel={viewModel.hostBadge}
                    onCopy={props.onCopyHostId}
                />
            ) : null}

            <DesktopPilotPanel
                viewModel={viewModel.pilotPanel}
                onCopyHostId={props.onCopyHostId}
                onTogglePilotPanel={props.onTogglePilotPanel}
                onToggleAtmosphere={props.onToggleAtmosphere}
                onToggleLocale={props.onToggleLocale}
            />

            <DesktopSettingsOverlay
                open={props.showSettingsOverlay}
                sessionMode={props.sessionMode}
                cameraMode={props.gameState.cameraMode}
                myId={props.myId}
                copyState={props.copyState}
                atmosphereEnabled={props.atmosphereEnabled}
                locale={props.locale}
                t={props.t}
                onClose={props.onCloseSettingsOverlay}
                onCopyHostId={props.onCopyHostId}
                onToggleCameraMode={props.onToggleCameraMode}
                onToggleAtmosphere={props.onToggleAtmosphere}
                onToggleLocale={props.onToggleLocale}
            />

            <TorsoTwistArc
                twistRatio={viewModel.bottomHud.twistRatio}
                maxTwist={props.gameState.maxTwist}
                t={props.t}
            />

            <CombatOverlayCore
                reticleX={viewModel.overlay.reticleX}
                reticleY={viewModel.overlay.reticleY}
                hitConfirmRatio={viewModel.overlay.hitConfirmRatio}
                hitTargetRatio={viewModel.overlay.hitTargetRatio}
                showAlignPrompt={viewModel.overlay.showAlignPrompt}
                alignPrompt={viewModel.overlay.alignPrompt}
                t={props.t}
            />

            <DesktopBottomHud
                gameState={props.gameState}
                viewModel={viewModel.bottomHud}
                locale={props.locale}
                t={props.t}
            />
        </>
    );
}
