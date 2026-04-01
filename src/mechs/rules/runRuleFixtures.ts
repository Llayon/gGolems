import * as assert from 'node:assert/strict';

import type { LoadoutDefinition } from '../types';
import { validateLoadoutDefinition } from '../definitions';
import { GOLEM_SECTION_ORDER } from '../sections';
import { createFixtureHeatState, createFixtureSectionState, createFixtureWeaponMounts } from './ruleFixtures';
import {
    applySectionDamageState,
    applySectionStatePatch,
    computeSectionTotals,
    resetSectionState
} from './sectionRules';
import { spendSteamState, tickSteamState } from './steamRules';
import {
    buildMountAvailabilityPatch,
    buildWeaponCooldownPatch,
    buildWeaponFireCooldownPatch,
    buildWeaponStatusViews,
    canAnyWeaponFire,
    evaluateReadyWeaponMounts
} from './weaponRules';

function runSmoke(name: string, fn: () => void) {
    fn();
    console.log(`PASS ${name}`);
}

runSmoke('section rules compute totals and lethal head damage deterministically', () => {
    const sections = createFixtureSectionState('kwii_strider');
    const totals = computeSectionTotals(sections, sections);

    assert.equal(totals.hp, GOLEM_SECTION_ORDER.reduce((sum, section) => sum + sections[section], 0));
    assert.equal(totals.maxHp, totals.hp);

    const damageResult = applySectionDamageState(sections, sections, 'head', 999);
    assert.equal(damageResult.remaining, 0);
    assert.equal(damageResult.destroyed, true);
    assert.equal(damageResult.lethal, true);
    assert.ok(damageResult.hp < totals.hp);
});

runSmoke('section rules patch and reset state without mutating unrelated values', () => {
    const sections = createFixtureSectionState('kwii_strider');
    const patched = applySectionStatePatch(sections, { leftArm: 3, rightLeg: 7 });

    assert.equal(patched.leftArm, 3);
    assert.equal(patched.rightLeg, 7);
    assert.equal(patched.centerTorso, sections.centerTorso);

    const reset = resetSectionState(sections);
    assert.deepEqual(reset, sections);
    assert.notEqual(reset, sections);
});

runSmoke('steam rules handle normal spend, threshold overheat, and recovery', () => {
    const healthy = createFixtureHeatState({ steam: 40 });
    const spend = spendSteamState(healthy, 10);
    assert.equal(spend.success, true);
    assert.equal(spend.nextState.steam, 30);
    assert.equal(spend.nextState.isOverheated, false);

    const threshold = spendSteamState(createFixtureHeatState({ steam: 20 }), 6);
    assert.equal(threshold.success, true);
    assert.equal(threshold.triggeredOverheat, true);
    assert.equal(threshold.nextState.isOverheated, true);

    const insufficient = spendSteamState(createFixtureHeatState({ steam: 5 }), 8);
    assert.equal(insufficient.success, false);
    assert.equal(insufficient.triggeredOverheat, true);

    const recovered = tickSteamState(createFixtureHeatState({
        steam: 0,
        isOverheated: true,
        overheatTimer: 0.1
    }), 0.2);
    assert.equal(recovered.isOverheated, false);
    assert.equal(recovered.steam, 20);
});

runSmoke('weapon rules derive availability, cooldowns, readiness, and status views', () => {
    const mounts = createFixtureWeaponMounts('kwii_strider');
    const mountOrder = ['rightArmMount', 'leftArmMount', 'torsoMount'] as const;

    const cooldownPatch = buildWeaponCooldownPatch(mounts, [...mountOrder], 0.25);
    assert.equal(cooldownPatch.rightArmMount, undefined);

    mounts.rightArmMount.cooldownRemaining = 0.5;
    const cooled = buildWeaponCooldownPatch(mounts, [...mountOrder], 0.25);
    assert.equal(cooled.rightArmMount, 0.25);

    const sectionPatch = buildMountAvailabilityPatch(
        mounts,
        [...mountOrder],
        createFixtureSectionState('kwii_strider', { rightArm: 0 })
    );
    assert.equal(sectionPatch.rightArmMount, false);

    const ready = evaluateReadyWeaponMounts(
        mounts,
        [...mountOrder],
        createFixtureHeatState({ steam: 100 })
    );
    assert.equal(ready.blockedReason, 'none');
    assert.deepEqual(ready.mountIds, ['leftArmMount', 'torsoMount']);
    assert.ok(ready.totalHeat > 0);

    const blocked = evaluateReadyWeaponMounts(
        mounts,
        [...mountOrder],
        createFixtureHeatState({ steam: 1 })
    );
    assert.equal(blocked.blockedReason, 'insufficientSteam');

    const firePatch = buildWeaponFireCooldownPatch(mounts, ['leftArmMount', 'torsoMount']);
    assert.ok(typeof firePatch.leftArmMount === 'number');
    assert.ok(typeof firePatch.torsoMount === 'number');

    const statuses = buildWeaponStatusViews(
        mounts,
        [...mountOrder],
        createFixtureHeatState({ steam: 1 })
    );
    assert.equal(statuses.find((item) => item.mountId === 'rightArmMount')?.state, 'recycle');
    assert.equal(statuses.find((item) => item.mountId === 'leftArmMount')?.state, 'heat');
    assert.equal(canAnyWeaponFire(mounts, [...mountOrder], createFixtureHeatState({ steam: 100 })), true);
});

runSmoke('loadout legality rejects incompatible or incomplete assignments', () => {
    const incompatibleLoadout: LoadoutDefinition = {
        id: 'kwii_standard',
        chassisId: 'kwii_strider',
        name: 'Broken',
        description: 'Broken',
        assignments: [
            { mountId: 'rightArmMount', weaponId: 'steam_cannon' },
            { mountId: 'leftArmMount', weaponId: 'arc_emitter' },
            { mountId: 'torsoMount', weaponId: 'steam_cannon' }
        ]
    };

    assert.throws(() => validateLoadoutDefinition(incompatibleLoadout), /not compatible/);

    const missingAssignmentLoadout: LoadoutDefinition = {
        id: 'kwii_standard',
        chassisId: 'kwii_strider',
        name: 'Missing',
        description: 'Missing',
        assignments: [
            { mountId: 'rightArmMount', weaponId: 'rune_bolt' },
            { mountId: 'leftArmMount', weaponId: 'arc_emitter' }
        ]
    };

    assert.throws(() => validateLoadoutDefinition(missingAssignmentLoadout), /missing assignment/i);
});

console.log('Rule fixtures completed successfully.');
