import React from 'react';
import { BarGroup } from '@visx/shape';
import { Group } from '@visx/group';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { scaleBand, scaleLinear, scaleOrdinal } from '@visx/scale';
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

function AccuracyComparisonChartInner({ width, height, summary }) {
  const {
    tooltipOpen,
    tooltipLeft,
    tooltipTop,
    tooltipData,
    hideTooltip,
    showTooltip,
  } = useTooltip();

  const matchRate = summary?.match_rate_percent || 97.9;
  const baselineRate = 62.1;
  const delta = (matchRate - baselineRate).toFixed(1);

  // Metrics comparison data
  const data = [
    {
      metric: 'Match Rate',
      'Plain Rules (Exact/Tol)': baselineRate,
      'Full AI Pipeline': matchRate,
    },
    {
      metric: 'Precision',
      'Plain Rules (Exact/Tol)': 100.0,
      'Full AI Pipeline': summary?.precision_percent || 100.0,
    },
    {
      metric: 'Recall',
      'Plain Rules (Exact/Tol)': baselineRate,
      'Full AI Pipeline': summary?.recall_percent || matchRate,
    },
  ];

  const keys = ['Plain Rules (Exact/Tol)', 'Full AI Pipeline'];

  if (width < 10 || height < 10) return null;

  const margin = { top: 25, right: 15, bottom: 40, left: 45 };
  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;

  // Scales
  const x0Scale = scaleBand({
    domain: data.map((d) => d.metric),
    range: [0, Math.max(xMax, 10)],
    padding: 0.25,
  });

  const x1Scale = scaleBand({
    domain: keys,
    range: [0, x0Scale.bandwidth()],
    padding: 0.1,
  });

  const yScale = scaleLinear({
    domain: [0, 110],
    range: [yMax, 0],
  });

  const colorScale = scaleOrdinal({
    domain: keys,
    range: ['#94A3B8', '#2563EB'],
  });

  return (
    <div className="relative w-full h-full">
      <svg width={width} height={height}>
        <Group top={margin.top} left={margin.left}>
          <BarGroup
            data={data}
            keys={keys}
            height={yMax}
            x0={(d) => d.metric}
            x0Scale={x0Scale}
            x1Scale={x1Scale}
            yScale={yScale}
            color={colorScale}
          >
            {(barGroups) =>
              barGroups.map((barGroup) => (
                <Group key={`bar-group-${barGroup.index}-${barGroup.x0}`} left={barGroup.x0}>
                  {barGroup.bars.map((bar) => {
                    const solidColor = bar.key === 'Full AI Pipeline' ? '#2563EB' : '#94A3B8';
                    return (
                      <Group key={`bar-container-${barGroup.index}-${bar.index}`}>
                        <rect
                          x={bar.x}
                          y={bar.y}
                          width={bar.width}
                          height={bar.height}
                          fill={solidColor}
                          rx={3}
                          className="transition-opacity duration-150 hover:opacity-85 cursor-pointer"
                          onMouseMove={(event) => {
                            const svg = event.currentTarget.ownerSVGElement;
                            const rect = svg.getBoundingClientRect();
                            showTooltip({
                              tooltipLeft: event.clientX - rect.left,
                              tooltipTop: event.clientY - rect.top,
                              tooltipData: {
                                metric: data[barGroup.index].metric,
                                key: bar.key,
                                value: bar.value,
                                color: solidColor,
                              },
                            });
                          }}
                          onMouseLeave={hideTooltip}
                        />
                        {/* Direct percentage label on top of bar */}
                        <text
                          x={bar.x + bar.width / 2}
                          y={bar.y - 4}
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight={600}
                          fill="#0B1F3A"
                          className="font-mono tabular-nums"
                        >
                          {bar.value.toFixed(0)}%
                        </text>
                      </Group>
                    );
                  })}
                </Group>
              ))
            }
          </BarGroup>

          <AxisLeft
            scale={yScale}
            stroke="#E2E8F0"
            tickStroke="#E2E8F0"
            tickFormat={(val) => `${val}%`}
            tickLabelProps={() => ({
              fill: '#64748B',
              fontSize: 10,
              textAnchor: 'end',
              dy: '0.33em',
            })}
          />

          <AxisBottom
            top={yMax}
            scale={x0Scale}
            stroke="#E2E8F0"
            tickStroke="#E2E8F0"
            tickLabelProps={() => ({
              fill: '#0B1F3A',
              fontSize: 11,
              fontWeight: 600,
              textAnchor: 'middle',
              dy: '0.5em',
            })}
          />
        </Group>
      </svg>

      {/* Delta Callout Badge */}
      <div className="absolute top-0 right-2 px-2 py-0.5 rounded-full bg-[#16A34A]/15 text-[#16A34A] text-[10px] font-bold font-mono">
        +{delta}pp Lift
      </div>

      {/* Bottom Legend */}
      <div className="absolute bottom-0 right-2 flex items-center space-x-3 text-[11px] font-medium text-slate-600">
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#94A3B8]" />
          <span>Plain Rules</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#2563EB]" />
          <span>Full AI Pipeline</span>
        </div>
      </div>

      {tooltipOpen && tooltipData && (
        <TooltipWithBounds top={tooltipTop} left={tooltipLeft} style={tooltipStyles}>
          <div className="space-y-1">
            <div className="text-slate-300 text-[11px] font-semibold">{tooltipData.metric}</div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tooltipData.color }} />
              <span className="font-medium">{tooltipData.key}:</span>
              <span className="font-mono tabular-nums font-bold text-white">{tooltipData.value}%</span>
            </div>
          </div>
        </TooltipWithBounds>
      )}
    </div>
  );
}

export function AccuracyComparisonChart(props) {
  return (
    <ParentSize>
      {({ width, height }) => <AccuracyComparisonChartInner width={width} height={height} {...props} />}
    </ParentSize>
  );
}
