import React from 'react';
import { Pie } from '@visx/shape';
import { Group } from '@visx/group';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { ParentSize } from '@visx/responsive';

const tooltipStyles = {
  ...defaultStyles,
  backgroundColor: '#000000',
  color: '#FFFFFF',
  borderRadius: '0px',
  padding: '8px 12px',
  fontSize: '12px',
  fontWeight: 'bold',
  boxShadow: '4px 4px 0px 0px #000000',
  border: '2px solid #FFFFFF',
  zIndex: 1000,
  pointerEvents: 'none',
};

function DonutChartInner({ width, height, matchesCount = 0, needsReviewCount = 0, exceptionsCount = 0 }) {
  const {
    tooltipOpen,
    tooltipLeft,
    tooltipTop,
    tooltipData,
    hideTooltip,
    showTooltip,
  } = useTooltip();

  const data = [
    { label: 'Auto-Matched', value: matchesCount, color: '#000000' },
    { label: 'Needs Review', value: needsReviewCount, color: '#71717A' },
    { label: 'Exceptions', value: exceptionsCount, color: '#E4E4E7' },
  ].filter(d => d.value >= 0);

  const total = data.reduce((acc, d) => acc + d.value, 0);

  if (width < 10 || height < 10) return null;

  const centerY = height / 2;
  const centerX = width / 2;
  const radius = Math.min(width, height) / 2;
  const innerRadius = radius * 0.55;
  const outerRadius = radius * 0.88;

  return (
    <div className="relative w-full h-full">
      <svg width={width} height={height}>
        <Group top={centerY} left={centerX}>
          <Pie
            data={data}
            pieValue={(d) => d.value}
            outerRadius={outerRadius}
            innerRadius={innerRadius}
            padAngle={0.04}
            cornerRadius={0}
          >
            {(pie) =>
              pie.arcs.map((arc) => {
                const { label, value, color } = arc.data;
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                return (
                  <path
                    key={label}
                    d={pie.path(arc) || ''}
                    fill={color}
                    stroke="#000000"
                    strokeWidth={2}
                    className="transition-opacity duration-150 hover:opacity-85 cursor-pointer"
                    onMouseMove={(event) => {
                      const svg = event.currentTarget.ownerSVGElement;
                      const rect = svg.getBoundingClientRect();
                      showTooltip({
                        tooltipLeft: event.clientX - rect.left,
                        tooltipTop: event.clientY - rect.top,
                        tooltipData: { label, value, percentage, color },
                      });
                    }}
                    onMouseLeave={hideTooltip}
                  />
                );
              })
            }
          </Pie>

          {/* Center Total Count */}
          <text
            textAnchor="middle"
            dy="-0.15em"
            className="fill-black font-black text-3xl font-mono tabular-nums"
          >
            {total}
          </text>
          <text
            textAnchor="middle"
            dy="1.3em"
            className="fill-zinc-600 font-extrabold text-[10px] uppercase tracking-wider"
          >
            Total Records
          </text>
        </Group>
      </svg>

      {tooltipOpen && tooltipData && (
        <TooltipWithBounds top={tooltipTop} left={tooltipLeft} style={tooltipStyles}>
          <div className="flex items-center space-x-2 font-mono text-xs">
            <span className="w-3 h-3 border border-white" style={{ backgroundColor: tooltipData.color }} />
            <span className="font-extrabold uppercase">{tooltipData.label}:</span>
            <span className="font-mono tabular-nums font-black">{tooltipData.value}</span>
            <span className="text-zinc-300">({tooltipData.percentage}%)</span>
          </div>
        </TooltipWithBounds>
      )}
    </div>
  );
}

export function DonutChart(props) {
  return (
    <ParentSize>
      {({ width, height }) => <DonutChartInner width={width} height={height} {...props} />}
    </ParentSize>
  );
}
