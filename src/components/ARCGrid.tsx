import React from 'react';

interface ARCGridProps {
  gridData: number[][];
  isInteractive?: boolean;
  onCellClick?: (r: number, c: number) => void;
  telemetryIdPrefix: string;
  logAction?: (type: string, payload: any) => void;
}

const COLORS = [
  '#000000', '#0074D9', '#FF4136', '#2ECC40', '#FFDC00',
  '#AAAAAA', '#F012BE', '#FF851B', '#7FDBFF', '#870C25'
];

export const ARCGrid: React.FC<ARCGridProps> = ({ gridData, isInteractive, onCellClick, telemetryIdPrefix, logAction }) => {
  const hoverStart = React.useRef<Record<string, number>>({});
  const rows = gridData.length;
  const cols = gridData[0]?.length ?? 0;
  const maxSide = Math.max(rows, cols);
  const cellSize = maxSide <= 5 ? 32 : maxSide <= 8 ? 28 : 24;

  return (
    <div 
      className="inline-flex flex-col border-2 border-gray-500 bg-black"
      data-telemetry-id={`${telemetryIdPrefix}_area`}
    >
      {gridData.map((row, rIndex) => (
        <div key={rIndex} className="flex">
          {row.map((color, cIndex) => {
            const cellId = `${telemetryIdPrefix}_cell_${rIndex}_${cIndex}`;
            return (
              <div
                key={cIndex}
                className="border border-gray-600 cursor-pointer transition-colors duration-100"
                style={{ backgroundColor: COLORS[color], width: cellSize, height: cellSize }}
                data-telemetry-id={cellId}
                onClick={() => {
                  if (isInteractive && onCellClick) {
                    onCellClick(rIndex, cIndex);
                  }
                }}
                onMouseEnter={() => {
                  hoverStart.current[cellId] = Date.now();
                }}
                onMouseLeave={() => {
                  const start = hoverStart.current[cellId];
                  if (start) {
                    const duration = Date.now() - start;
                    if (duration > 500 && logAction) {
                      logAction('cell_hover_long', { r: rIndex, c: cIndex, duration, area: telemetryIdPrefix });
                    }
                  }
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};
