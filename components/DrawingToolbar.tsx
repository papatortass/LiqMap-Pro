
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
    Palette
} from 'lucide-react';
import { DrawingToolType, DrawingStyle } from '../types';

interface DrawingToolbarProps {
    activeTool: DrawingToolType;
    setTool: (t: DrawingToolType) => void;
    currentStyle: DrawingStyle;
    setStyle: (s: DrawingStyle) => void;
    onClear: () => void;
    hasDrawings: boolean;
}

const DrawingToolbar: React.FC<DrawingToolbarProps> = ({ 
    activeTool, 
    setTool, 
    currentStyle, 
    setStyle, 
    onClear, 
    hasDrawings 
}) => {
    
    const [showSettings, setShowSettings] = useState(true);

    const tools = [
        { id: 'cursor', icon: <MousePointer2 size={18} />, label: 'Cursor' },
        { id: 'ruler', icon: <Ruler size={18} />, label: 'Measure' },
        { id: 'trend', icon: <TrendingUp size={18} />, label: 'Trend Line' },
        { id: 'ray', icon: <ArrowUpRight size={18} />, label: 'Ray' },
        { id: 'arrow', icon: <MoveRight size={18} />, label: 'Arrow' },
        { id: 'horizontal', icon: <Minus size={18} />, label: 'Horz Line' },
        { id: 'vertical', icon: <MoveVertical size={18} />, label: 'Vert Line' },
        { id: 'rectangle', icon: <Square size={18} />, label: 'Rect Zone' },
        { id: 'circle', icon: <Circle size={18} />, label: 'Circle' },
        { id: 'fib', icon: <Scaling size={18} />, label: 'Fibonacci' },
    ];

    const colors = [
        '#3b82f6', // Blue
        '#ef4444', // Red
        '#10b981', // Green
        '#eab308', // Yellow
        '#a855f7', // Purple
        '#f97316', // Orange
        '#ffffff', // White
    ];

    const widths = [1, 2, 3, 4];

    return (
        <>
            {/* Main Toolbar */}
            <div className="absolute left-4 top-20 z-30 flex flex-col gap-2">
                <div className="bg-[#050505]/90 backdrop-blur-xl border border-white/10 rounded-lg p-1.5 shadow-2xl flex flex-col gap-1">
                    {tools.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTool(t.id as DrawingToolType)}
                            className={`p-2 rounded transition-all group relative ${
                                activeTool === t.id 
                                ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]' 
                                : 'text-gray-400 hover:text-white hover:bg-white/10'
                            }`}
                            title={t.label}
                        >
                            {t.icon}
                            <span className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-gray-900 border border-white/10 rounded text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                                {t.label}
                            </span>
                        </button>
                    ))}

                    <div className="h-px w-full bg-white/10 my-1"></div>

                    <button
                        onClick={onClear}
                        disabled={!hasDrawings}
                        className={`p-2 rounded transition-all group relative ${
                            !hasDrawings 
                            ? 'text-gray-700 cursor-not-allowed' 
                            : 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
                        }`}
                        title="Clear All"
                    >
                        <Trash2 size={18} />
                        <span className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-gray-900 border border-white/10 rounded text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                            Clear All
                        </span>
                    </button>
                </div>
            </div>

            {/* Tool Properties Panel (Only visible when a drawing tool is active) */}
            {activeTool !== 'cursor' && (
                <div className="absolute left-[72px] top-20 z-30 animate-in fade-in slide-in-from-left-4 duration-200">
                    <div className="bg-[#050505]/90 backdrop-blur-xl border border-white/10 rounded-lg p-3 shadow-2xl flex flex-col gap-3 min-w-[160px]">
                        
                        <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider pb-2 border-b border-white/5">
                            <span>Settings</span>
                            <Settings2 size={12} />
                        </div>

                        {/* Color Picker */}
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] text-gray-500 uppercase">Stroke Color</span>
                            <div className="grid grid-cols-4 gap-1.5">
                                {colors.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setStyle({ ...currentStyle, color: c })}
                                        className={`w-6 h-6 rounded-full border border-white/10 transition-transform hover:scale-110 ${currentStyle.color === c ? 'ring-2 ring-white' : ''}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                                {/* Custom Color Input Wrapper */}
                                <div className="relative w-6 h-6 rounded-full border border-white/10 overflow-hidden group cursor-pointer bg-gradient-to-br from-purple-500 to-pink-500">
                                     <input 
                                        type="color" 
                                        value={currentStyle.color}
                                        onChange={(e) => setStyle({ ...currentStyle, color: e.target.value })}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                     />
                                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100">
                                        <Palette size={12} className="text-white drop-shadow-md" />
                                     </div>
                                </div>
                            </div>
                        </div>

                        {/* Width Picker */}
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] text-gray-500 uppercase">Line Width</span>
                            <div className="flex gap-1 bg-white/5 rounded p-1">
                                {widths.map(w => (
                                    <button
                                        key={w}
                                        onClick={() => setStyle({ ...currentStyle, lineWidth: w })}
                                        className={`flex-1 h-6 flex items-center justify-center rounded transition-all ${currentStyle.lineWidth === w ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-white/10'}`}
                                    >
                                        <div className="bg-current rounded-full" style={{ width: w * 3, height: w * 3 }}></div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Line Style */}
                        <div className="flex flex-col gap-2">
                             <span className="text-[10px] text-gray-500 uppercase">Style</span>
                             <div className="flex gap-1 bg-white/5 rounded p-1">
                                <button
                                    onClick={() => setStyle({...currentStyle, lineStyle: 'solid'})}
                                    className={`flex-1 h-6 flex items-center justify-center rounded ${currentStyle.lineStyle === 'solid' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-white/10'}`}
                                    title="Solid"
                                >
                                    <div className="w-full h-0.5 bg-current mx-1"></div>
                                </button>
                                <button
                                    onClick={() => setStyle({...currentStyle, lineStyle: 'dashed'})}
                                    className={`flex-1 h-6 flex items-center justify-center rounded ${currentStyle.lineStyle === 'dashed' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-white/10'}`}
                                    title="Dashed"
                                >
                                    <div className="w-full h-0.5 border-t-2 border-dashed border-current mx-1"></div>
                                </button>
                                <button
                                    onClick={() => setStyle({...currentStyle, lineStyle: 'dotted'})}
                                    className={`flex-1 h-6 flex items-center justify-center rounded ${currentStyle.lineStyle === 'dotted' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-white/10'}`}
                                    title="Dotted"
                                >
                                    <div className="w-full h-0.5 border-t-2 border-dotted border-current mx-1"></div>
                                </button>
                             </div>
                        </div>

                        {/* Fill Opacity (For Shape Tools) */}
                        {(activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'ruler') && (
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between text-[10px] text-gray-500 uppercase">
                                    <span>Fill Opacity</span>
                                    <span>{(currentStyle.fillOpacity * 100).toFixed(0)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={currentStyle.fillOpacity}
                                    onChange={(e) => setStyle({...currentStyle, fillOpacity: parseFloat(e.target.value)})}
                                    className="w-full h-2 cursor-pointer"
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
