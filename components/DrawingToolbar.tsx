
import React, { useState } from 'react';
import { 
    MousePointer2, 
    TrendingUp, 
    Minus, 
    Trash2, 
    Square, 
    Scaling, 
    ArrowUpRight, 
    MoveRight, 
    MoveVertical, 
    Circle,
    Ruler,
    Settings2,
    Palette,
    Brush,
    MoreHorizontal,
    Lock,
    Unlock,
    ArrowUpCircle,
    ArrowDownCircle
} from 'lucide-react';
import { DrawingToolType, DrawingStyle } from '../types';

interface DrawingToolbarProps {
    activeTool: DrawingToolType;
    setTool: (t: DrawingToolType) => void;
    currentStyle: DrawingStyle;
    setStyle: (s: DrawingStyle) => void;
    onClear: () => void;
    hasDrawings: boolean;
    isDrawingSelected: boolean;
    effectiveToolType: DrawingToolType; // The type of the selected drawing OR the active tool
    isLocked: boolean;
    onToggleLock: () => void;
}

const DrawingToolbar: React.FC<DrawingToolbarProps> = ({ 
    activeTool, 
    setTool, 
    currentStyle, 
    setStyle, 
    onClear, 
    hasDrawings,
    isDrawingSelected,
    effectiveToolType,
    isLocked,
    onToggleLock
}) => {
    
    const tools = [
        { id: 'cursor', icon: <MousePointer2 size={16} />, label: 'Cursor', shortcut: 'Esc' },
        { id: 'long', icon: <ArrowUpCircle size={16} />, label: 'Long Pos', shortcut: 'L' },
        { id: 'short', icon: <ArrowDownCircle size={16} />, label: 'Short Pos', shortcut: 'S' },
        { id: 'ruler', icon: <Ruler size={16} />, label: 'Measure', shortcut: 'Q' },
        { id: 'brush', icon: <Brush size={16} />, label: 'Brush', shortcut: 'E' },
        { id: 'fib', icon: <Scaling size={16} />, label: 'Fibonacci', shortcut: 'R' },
        { id: 'trend', icon: <TrendingUp size={16} />, label: 'Trend Line', shortcut: 'T' },
        { id: 'horizontal', icon: <Minus size={16} />, label: 'Horz Line', shortcut: 'F' },
        { id: 'vertical', icon: <MoveVertical size={16} />, label: 'Vert Line' },
        { id: 'ray', icon: <ArrowUpRight size={16} />, label: 'Ray' },
        { id: 'arrow', icon: <MoveRight size={16} />, label: 'Arrow' },
        { id: 'rectangle', icon: <Square size={16} />, label: 'Rect Zone' },
        { id: 'circle', icon: <Circle size={16} />, label: 'Circle' },
    ];

    const colors = [
        '#3b82f6', // Blue
        '#10b981', // Green
        '#ef4444', // Red
        '#f97316', // Orange
        '#eab308', // Yellow
        '#a855f7', // Purple
        '#ec4899', // Pink
        '#ffffff', // White
        '#9ca3af', // Gray
        '#000000', // Black
    ];

    const widths = [1, 2, 3, 4];

    // Tools that do not support property customization
    const unconfigurableTools = ['cursor', 'ruler'];
    
    // Tools that use semantic colors (Green/Red) so manual color picking is hidden
    const semanticColorTools = ['long', 'short'];

    // Show panel logic
    const showPropertiesPanel = !unconfigurableTools.includes(effectiveToolType) && (activeTool !== 'cursor' || isDrawingSelected);

    // Conditional render flags for specific sections
    const showLineStyle = !['brush', 'long', 'short'].includes(effectiveToolType);
    const showOpacity = ['rectangle', 'circle', 'long', 'short'].includes(effectiveToolType);
    const showColorPicker = !semanticColorTools.includes(effectiveToolType);

    return (
        <>
            {/* Main Toolbar */}
            <div className="absolute left-4 top-20 z-30 flex flex-col gap-2">
                <div className="bg-[#050505]/90 backdrop-blur-xl border border-white/10 rounded-lg p-1 shadow-2xl flex flex-col gap-0.5 w-[42px] items-center">
                    {tools.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTool(t.id as DrawingToolType)}
                            className={`w-8 h-8 rounded flex items-center justify-center transition-all group relative ${
                                activeTool === t.id 
                                ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]' 
                                : 'text-gray-400 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            {t.icon}
                            
                            {/* Shortcut Indicator Badge */}
                            {t.shortcut && (
                                <span className={`absolute bottom-[2px] right-[2px] text-[6px] font-mono font-bold leading-none ${activeTool === t.id ? 'text-blue-200' : 'text-gray-600 group-hover:text-gray-400'}`}>
                                    {t.shortcut}
                                </span>
                            )}

                            {/* Tooltip */}
                            <span className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-gray-900 border border-white/10 rounded text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                                {t.label} {t.shortcut && <span className="opacity-50 ml-1">({t.shortcut})</span>}
                            </span>
                        </button>
                    ))}

                    <div className="h-px w-6 bg-white/10 my-1"></div>

                    {/* Lock Drawings Button */}
                    <button
                        onClick={onToggleLock}
                        disabled={!hasDrawings}
                        className={`w-8 h-8 rounded flex items-center justify-center transition-all group relative ${
                            !hasDrawings 
                            ? 'text-gray-700 cursor-not-allowed'
                            : isLocked
                                ? 'text-blue-400 bg-blue-500/10'
                                : 'text-gray-400 hover:text-white hover:bg-white/10'
                        }`}
                    >
                        {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                        <span className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-gray-900 border border-white/10 rounded text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                            {isLocked ? 'Unlock Drawings' : 'Lock Drawings'}
                        </span>
                    </button>

                    {/* Clear All Button */}
                    <button
                        onClick={onClear}
                        disabled={!hasDrawings}
                        className={`w-8 h-8 rounded flex items-center justify-center transition-all group relative ${
                            !hasDrawings 
                            ? 'text-gray-700 cursor-not-allowed' 
                            : 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
                        }`}
                    >
                        <Trash2 size={16} />
                        <span className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-gray-900 border border-white/10 rounded text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                            Clear All <span className="opacity-50 ml-1">(Del)</span>
                        </span>
                    </button>
                </div>
            </div>

            {/* Compact Properties Panel */}
            {showPropertiesPanel && (
                <div className="absolute left-[66px] top-20 z-30 animate-in fade-in slide-in-from-left-2 duration-200">
                    <div className="bg-[#050505]/95 backdrop-blur-xl border border-white/10 rounded-lg p-2 shadow-2xl flex flex-col gap-2 w-[140px]">
                        
                        {/* Header */}
                        <div className="flex items-center justify-between text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1">
                            <span>{isDrawingSelected ? 'Edit Style' : 'Properties'}</span>
                            <Settings2 size={10} />
                        </div>

                        {/* Color Grid */}
                        {showColorPicker && (
                            <>
                                <div className="grid grid-cols-5 gap-1.5 p-1 bg-white/5 rounded">
                                    {colors.map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setStyle({ ...currentStyle, color: c })}
                                            className={`w-4 h-4 rounded-full transition-transform hover:scale-110 ${currentStyle.color === c ? 'ring-1 ring-white ring-offset-1 ring-offset-black' : ''}`}
                                            style={{ backgroundColor: c }}
                                            title={c}
                                        />
                                    ))}
                                    {/* Custom Color Input */}
                                    <div className="relative w-4 h-4 rounded-full overflow-hidden group cursor-pointer bg-gradient-to-br from-purple-500 to-pink-500 hover:scale-110 transition-transform">
                                            <input 
                                            type="color" 
                                            value={currentStyle.color}
                                            onChange={(e) => setStyle({ ...currentStyle, color: e.target.value })}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <Palette size={8} className="text-white" />
                                            </div>
                                    </div>
                                </div>
                                <div className="h-px bg-white/5 mx-1"></div>
                            </>
                        )}

                        {/* Stroke Width */}
                        <div className="flex items-center justify-between bg-white/5 rounded p-0.5">
                            {widths.map(w => (
                                <button
                                    key={w}
                                    onClick={() => setStyle({ ...currentStyle, lineWidth: w })}
                                    className={`flex-1 h-5 flex items-center justify-center rounded-sm transition-all ${currentStyle.lineWidth === w ? 'bg-white/20 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                    title={`${w}px`}
                                >
                                    <div className="bg-current rounded-full" style={{ width: 2 + w, height: 2 + w }}></div>
                                </button>
                            ))}
                        </div>

                        {/* Line Style (Conditional) */}
                        {showLineStyle && (
                            <div className="flex items-center justify-between bg-white/5 rounded p-0.5">
                                <button
                                    onClick={() => setStyle({...currentStyle, lineStyle: 'solid'})}
                                    className={`flex-1 h-5 flex items-center justify-center rounded-sm ${currentStyle.lineStyle === 'solid' ? 'bg-white/20 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                    title="Solid"
                                >
                                    <Minus size={12} />
                                </button>
                                <button
                                    onClick={() => setStyle({...currentStyle, lineStyle: 'dashed'})}
                                    className={`flex-1 h-5 flex items-center justify-center rounded-sm ${currentStyle.lineStyle === 'dashed' ? 'bg-white/20 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                    title="Dashed"
                                >
                                    <MoreHorizontal size={12} />
                                </button>
                                <button
                                    onClick={() => setStyle({...currentStyle, lineStyle: 'dotted'})}
                                    className={`flex-1 h-5 flex items-center justify-center rounded-sm ${currentStyle.lineStyle === 'dotted' ? 'bg-white/20 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                    title="Dotted"
                                >
                                    <div className="flex gap-0.5">
                                        <div className="w-0.5 h-0.5 bg-current rounded-full"></div>
                                        <div className="w-0.5 h-0.5 bg-current rounded-full"></div>
                                        <div className="w-0.5 h-0.5 bg-current rounded-full"></div>
                                    </div>
                                </button>
                            </div>
                        )}

                        {/* Opacity (Conditional) */}
                        {showOpacity && (
                            <div className="flex flex-col gap-1 mt-1">
                                <div className="flex justify-between text-[9px] text-gray-500 uppercase font-mono">
                                    <span>Opacity</span>
                                    <span>{(currentStyle.fillOpacity * 100).toFixed(0)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={currentStyle.fillOpacity}
                                    onChange={(e) => setStyle({...currentStyle, fillOpacity: parseFloat(e.target.value)})}
                                    className="w-full h-1.5 cursor-pointer accent-blue-500"
                                />
                            </div>
                        )}

                    </div>
                </div>
            )}
        </>
    );
};

export default DrawingToolbar;
