import React from 'react';
import { Pie } from '@visx/shape';
import { Group } from '@visx/group';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { ParentSize } from '@visx/responsive';

const tooltipStyles = {
  ...defaultStyles,
  backgroundColor: '#0B1F3A',
  color: '#FFFFFF',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '12px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
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
    { label: 'Auto-Matched', value: matchesCount, color: '#16A34A' },
    { label: 'Needs Review', value: needsReviewCount, color: '#D97706' },
    { label: 'Exceptions', value: exceptionsCount, color: '#DC2626' },
  ].filter(d => d.value >= 0);

  const total = data.reduce((acc, d) => acc + d.value, 0);

  if (width < 10 || height < 10) return null;

  const centerY = height / 2;
  const centerX = width / 2;
  const radius = Math.min(width, height) / 2;
  const innerRadius = radius * 0.58;
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
            padAngle={0.03}
            cornerRadius={3}
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
            className="fill-[#0B1F3A] font-bold text-2xl font-mono tabular-nums"
          >
            {total}
          </text>
          <text
            textAnchor="middle"
            dy="1.3em"
            className="fill-slate-400 font-medium text-[10px] uppercase tracking-wider"
          >
            Total Records
          </text>
        </Group>
      </svg>

      {tooltipOpen && tooltipData && (
        <TooltipWithBounds top={tooltipTop} left={tooltipLeft} style={tooltipStyles}>
          <div className="flex items-center space-x-2 font-medium">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tooltipData.color }} />
            <span className="font-semibold">{tooltipData.label}:</span>
            <span className="font-mono tabular-nums font-bold">{tooltipData.value}</span>
            <span className="text-slate-300 text-[11px]">({tooltipData.percentage}%)</span>
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
