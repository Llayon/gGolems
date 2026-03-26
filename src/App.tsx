/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { initGame } from './core/Engine';

export default function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [loading, setLoading] = useState(false);
    const [inLobby, setInLobby] = useState(true);
    const [hostId, setHostId] = useState('');
    const [myId, setMyId] = useState('');
    const [isHost, setIsHost] = useState(false);
    const [gameInstance, setGameInstance] = useState<any>(null);
    const [gameState, setGameState] = useState({
        hp: 100, maxHp: 100, steam: 100, maxSteam: 100, isOverheated: false, overheatTimer: 0, aimOffsetX: 0, aimOffsetY: 0
    });

    const startGame = async (mode: 'host' | 'client', targetHostId?: string) => {
        if (!canvasRef.current) return;
        setInLobby(false);
        setLoading(true);
        
        const game = await initGame(canvasRef.current, (state: any) => {
            setGameState({...state});
        });
        
        setGameInstance(game);
        
        if (mode === 'host') {
            game.network.initAsHost((id: string) => {
                setMyId(id);
                setIsHost(true);
                setLoading(false);
            });
        } else if (targetHostId) {
            game.setClientMode();
            game.network.initAsClient(targetHostId, (id: string) => {
                setMyId(id);
                setIsHost(false);
                setLoading(false);
            }, (err: any) => {
                console.error(err);
                alert("Ошибка подключения: " + err);
                setInLobby(true);
                setLoading(false);
            });
        }
    };

    useEffect(() => {
        return () => {
            if (gameInstance) gameInstance.stop();
        };
    }, [gameInstance]);

    return (
        <div className="w-full h-screen overflow-hidden bg-[#1a1a2e] relative font-mono">
            <canvas ref={canvasRef} className={`w-full h-full block ${inLobby ? 'hidden' : ''}`} />
            
            {inLobby && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a2e] z-50 text-white">
                    <h1 className="text-4xl font-bold text-orange-400 mb-8 tracking-wider drop-shadow-[0_0_10px_rgba(255,165,0,0.8)]">ПАРОМАГИЧЕСКИЕ ГОЛЕМЫ</h1>
                    
                    <div className="bg-black/50 p-8 rounded-lg border border-orange-500/30 backdrop-blur-sm flex flex-col gap-6 w-96">
                        <button 
                            onClick={() => startGame('host')}
                            className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded transition-colors shadow-[0_0_15px_rgba(255,100,0,0.5)]"
                        >
                            СОЗДАТЬ ИГРУ (ХОСТ)
                        </button>
                        
                        <div className="flex items-center gap-4">
                            <div className="h-px bg-orange-500/30 flex-1"></div>
                            <span className="text-orange-300/50 text-sm">ИЛИ</span>
                            <div className="h-px bg-orange-500/30 flex-1"></div>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                            <input 
                                type="text" 
                                placeholder="ID Хоста" 
                                value={hostId}
                                onChange={e => setHostId(e.target.value)}
                                className="w-full px-4 py-2 bg-black/80 border border-orange-500/50 rounded text-orange-200 focus:outline-none focus:border-orange-400"
                            />
                            <button 
                                onClick={() => startGame('client', hostId)}
                                disabled={!hostId}
                                className="w-full py-3 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded transition-colors shadow-[0_0_15px_rgba(0,170,255,0.3)]"
                            >
                                ПОДКЛЮЧИТЬСЯ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {loading && !inLobby && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a2e] z-50">
                    <div className="text-orange-400 text-2xl animate-pulse">Загрузка парового котла...</div>
                </div>
            )}

            {!loading && !inLobby && (
                <>
                    <div className="absolute top-4 left-4 text-white/80 text-sm pointer-events-none select-none">
                        <h1 className="text-2xl font-bold text-orange-400 mb-2 tracking-wider drop-shadow-[0_0_5px_rgba(255,165,0,0.8)]">ПАРОМАГИЧЕСКИЕ ГОЛЕМЫ</h1>
                        <div className="bg-black/50 p-4 rounded border border-orange-500/30 backdrop-blur-sm mb-2">
                            <p className="mb-2 text-orange-300 font-bold">ФАЗА 2: МУЛЬТИПЛЕЕР</p>
                            <p className="text-xs text-gray-400 mb-2">
                                {isHost ? 'Вы — ХОСТ' : 'Вы — КЛИЕНТ'} <br/>
                                Ваш ID: <span className="text-white select-all pointer-events-auto">{myId}</span>
                            </p>
                            <ul className="space-y-1">
                                <li><span className="text-orange-400">ЛКМ</span> — Рунный болт (-5 пара)</li>
                                <li><span className="text-orange-400">SHIFT</span> — Рывок (-30 пара)</li>
                                <li><span className="text-orange-400">SPACE</span> — Сброс пара (AoE)</li>
                                <li><span className="text-orange-400">ESC</span> — Освободить мышь</li>
                            </ul>
                        </div>
                    </div>

                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[400px] pointer-events-none select-none flex flex-col gap-2">
                        <div className="relative h-6 bg-black/60 border border-red-900/50 rounded overflow-hidden">
                            <div 
                                className="absolute top-0 left-0 h-full bg-red-600 transition-all duration-200"
                                style={{ width: `${(gameState.hp / gameState.maxHp) * 100}%` }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">
                                БРОНЯ: {Math.ceil(gameState.hp)} / {gameState.maxHp}
                            </div>
                        </div>

                        <div className={`relative h-6 bg-black/60 border rounded overflow-hidden transition-colors ${gameState.isOverheated ? 'border-red-500 animate-pulse' : 'border-orange-900/50'}`}>
                            <div 
                                className={`absolute top-0 left-0 h-full transition-all duration-100 ${gameState.isOverheated ? 'bg-red-500' : 'bg-orange-500'}`}
                                style={{ width: `${(gameState.steam / gameState.maxSteam) * 100}%` }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">
                                {gameState.isOverheated 
                                    ? `ПЕРЕГРЕВ! (${gameState.overheatTimer.toFixed(1)}с)` 
                                    : `ПАР: ${Math.ceil(gameState.steam)} / ${gameState.maxSteam}`
                                }
                            </div>
                        </div>
                    </div>

                    <div className="absolute top-1/2 left-1/2 w-8 h-8 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-70">
                        <div className="absolute top-1/2 left-0 w-3 h-[2px] -translate-y-1/2 bg-white/30"></div>
                        <div className="absolute top-1/2 right-0 w-3 h-[2px] -translate-y-1/2 bg-white/30"></div>
                        <div className="absolute top-0 left-1/2 w-[2px] h-3 -translate-x-1/2 bg-white/30"></div>
                        <div className="absolute bottom-0 left-1/2 w-[2px] h-3 -translate-x-1/2 bg-white/30"></div>
                    </div>

                    <div 
                        className="absolute top-1/2 left-1/2 w-8 h-8 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-90 transition-transform duration-75"
                        style={{
                            transform: `translate(calc(-50% + ${Math.max(-320, Math.min(320, gameState.aimOffsetX * 320))}px), calc(-50% + ${Math.max(-220, Math.min(220, -gameState.aimOffsetY * 180))}px))`
                        }}
                    >
                        <div className={`absolute top-1/2 left-0 w-3 h-[2px] -translate-y-1/2 shadow-[0_0_8px_currentColor] transition-colors ${(Math.abs(gameState.aimOffsetX) > 0.05 || Math.abs(gameState.aimOffsetY) > 0.05) ? 'bg-orange-500 text-orange-500' : 'bg-cyan-400 text-cyan-400'}`}></div>
                        <div className={`absolute top-1/2 right-0 w-3 h-[2px] -translate-y-1/2 shadow-[0_0_8px_currentColor] transition-colors ${(Math.abs(gameState.aimOffsetX) > 0.05 || Math.abs(gameState.aimOffsetY) > 0.05) ? 'bg-orange-500 text-orange-500' : 'bg-cyan-400 text-cyan-400'}`}></div>
                        <div className={`absolute top-0 left-1/2 w-[2px] h-3 -translate-x-1/2 shadow-[0_0_8px_currentColor] transition-colors ${(Math.abs(gameState.aimOffsetX) > 0.05 || Math.abs(gameState.aimOffsetY) > 0.05) ? 'bg-orange-500 text-orange-500' : 'bg-cyan-400 text-cyan-400'}`}></div>
                        <div className={`absolute bottom-0 left-1/2 w-[2px] h-3 -translate-x-1/2 shadow-[0_0_8px_currentColor] transition-colors ${(Math.abs(gameState.aimOffsetX) > 0.05 || Math.abs(gameState.aimOffsetY) > 0.05) ? 'bg-orange-500 text-orange-500' : 'bg-cyan-400 text-cyan-400'}`}></div>
                        <div className={`absolute top-1/2 left-1/2 w-1 h-1 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_8px_currentColor] transition-colors ${(Math.abs(gameState.aimOffsetX) > 0.05 || Math.abs(gameState.aimOffsetY) > 0.05) ? 'bg-orange-500 text-orange-500' : 'bg-cyan-400 text-cyan-400'}`}></div>
                    </div>
                </>
            )}
        </div>
    );
}
