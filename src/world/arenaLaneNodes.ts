import * as THREE from 'three';
import type { ControlPointId, TeamId } from '../gameplay/types';

export type ArenaLaneNodeKind = 'lane_anchor' | 'hold_node' | 'rotate_node' | 'retreat_node' | 'staging_node' | 'objective_entry';
export type ArenaLaneNodeSide = 'left' | 'right' | 'center';

export type ArenaLaneNode = {
    id: string;
    lane: ControlPointId;
    kind: ArenaLaneNodeKind;
    team: TeamId;
    side: ArenaLaneNodeSide;
    position: THREE.Vector3;
};

export type LaneNodeBuilder = {
    createGroundPoint: (x: number, z: number) => THREE.Vector3;
};

export function createLaneNodes(builder: LaneNodeBuilder): ArenaLaneNode[] {
    const nodes: ArenaLaneNode[] = [];
    const add = (
        lane: ControlPointId,
        kind: ArenaLaneNodeKind,
        team: TeamId,
        side: ArenaLaneNodeSide,
        x: number,
        z: number
    ) => {
        nodes.push({
            id: `${lane}:${team}:${kind}:${side}`,
            lane,
            kind,
            team,
            side,
            position: builder.createGroundPoint(x, z)
        });
    };

    const addTriplet = (
        lane: ControlPointId,
        kind: ArenaLaneNodeKind,
        team: TeamId,
        center: [number, number],
        left: [number, number],
        right: [number, number]
    ) => {
        add(lane, kind, team, 'center', center[0], center[1]);
        add(lane, kind, team, 'left', left[0], left[1]);
        add(lane, kind, team, 'right', right[0], right[1]);
    };

    addTriplet('A', 'objective_entry', 'blue', [60, 38], [56, 24], [56, 52]);
    addTriplet('A', 'hold_node', 'blue', [70, 38], [68, 28], [68, 48]);
    addTriplet('A', 'rotate_node', 'blue', [50, 38], [46, 18], [48, 60]);
    addTriplet('A', 'staging_node', 'blue', [44, 38], [42, 28], [42, 48]);
    addTriplet('A', 'retreat_node', 'blue', [34, 38], [34, 30], [34, 46]);

    addTriplet('A', 'objective_entry', 'red', [100, 38], [104, 52], [104, 24]);
    addTriplet('A', 'hold_node', 'red', [90, 38], [92, 48], [92, 28]);
    addTriplet('A', 'rotate_node', 'red', [110, 38], [114, 58], [114, 18]);
    addTriplet('A', 'staging_node', 'red', [116, 38], [118, 48], [118, 28]);
    addTriplet('A', 'retreat_node', 'red', [122, 38], [122, 46], [122, 30]);

    addTriplet('B', 'objective_entry', 'blue', [-16, -6], [-12, -22], [-12, 10]);
    addTriplet('B', 'hold_node', 'blue', [-6, -6], [-8, -16], [-8, 4]);
    addTriplet('B', 'rotate_node', 'blue', [-24, -6], [-24, -26], [-24, 12]);
    addTriplet('B', 'staging_node', 'blue', [-32, -6], [-32, -18], [-32, 8]);
    addTriplet('B', 'retreat_node', 'blue', [-46, -6], [-46, -16], [-46, 6]);

    addTriplet('B', 'objective_entry', 'red', [16, -6], [12, 10], [12, -22]);
    addTriplet('B', 'hold_node', 'red', [6, -6], [8, 4], [8, -16]);
    addTriplet('B', 'rotate_node', 'red', [24, -6], [24, 12], [24, -26]);
    addTriplet('B', 'staging_node', 'red', [32, -6], [32, 8], [32, -18]);
    addTriplet('B', 'retreat_node', 'red', [46, -6], [46, 6], [46, -16]);

    addTriplet('C', 'objective_entry', 'blue', [-100, 38], [-104, 52], [-104, 24]);
    addTriplet('C', 'hold_node', 'blue', [-90, 38], [-92, 48], [-92, 28]);
    addTriplet('C', 'rotate_node', 'blue', [-110, 38], [-114, 58], [-114, 18]);
    addTriplet('C', 'staging_node', 'blue', [-116, 38], [-118, 48], [-118, 28]);
    addTriplet('C', 'retreat_node', 'blue', [-122, 38], [-122, 46], [-122, 30]);

    addTriplet('C', 'objective_entry', 'red', [-64, 38], [-60, 24], [-60, 52]);
    addTriplet('C', 'hold_node', 'red', [-74, 38], [-72, 28], [-72, 48]);
    addTriplet('C', 'rotate_node', 'red', [-54, 38], [-50, 18], [-48, 60]);
    addTriplet('C', 'staging_node', 'red', [-46, 38], [-44, 28], [-44, 48]);
    addTriplet('C', 'retreat_node', 'red', [-38, 38], [-38, 30], [-38, 46]);

    return nodes;
}

export function getLaneNode(
    laneNodes: ArenaLaneNode[],
    lane: ControlPointId,
    kind: ArenaLaneNodeKind,
    team: TeamId,
    side: ArenaLaneNodeSide = 'center'
): THREE.Vector3 | null {
    const exact = laneNodes.find((node) =>
        node.lane === lane &&
        node.kind === kind &&
        node.team === team &&
        node.side === side
    );
    if (exact) return exact.position.clone();

    const center = laneNodes.find((node) =>
        node.lane === lane &&
        node.kind === kind &&
        node.team === team &&
        node.side === 'center'
    );
    if (center) return center.position.clone();

    return null;
}
