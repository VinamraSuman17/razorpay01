import React from 'react';
import { BarGroup } from '@visx/shape';
import { Group } from '@visx/group';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { scaleBand, scaleLinear, scaleOrdinal } from '@visx/scale';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { ParentSize } from '@visx/responsive';

const tooltipStyles = {
  ...defaultStyles,
  backgroundColor: '#18181B',
  color: '#FAFAFA',
  borderRadius: '0px',
  padding: '8px 12px',
  fontSize: '12px',
  fontWeight: 'bold',
  boxShadow: '4px 4px 0px 0px #18181B',
  border: '2px solid #FAFAFA',
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

  const margin = { top: 35, right: 15, bottom: 40, left: 45 };
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
    domain: [0, 115],
    range: [yMax, 0],
  });

  const colorScale = scaleOrdinal({
    domain: keys,
    range: ['#A1A1AA', '#18181B'],
  });

  return (
    <div className="relative w-full h-full">
      {/* Delta Callout Annotation Pill */}
      <div className="absolute top-0 right-2 z-10">
        <span className="px-2.5 py-1 text-[11px] font-black uppercase bg-[#18181B] text-[#FAFAFA] border-1.5 border-[#18181B] shadow-[2px_2px_0px_0px_#18181B]">
          +{delta}pp Lift
        </span>
      </div>

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
                    const value = bar.value;
                    const formattedVal = `${value.toFixed(0)}%`;

                    return (
                      <Group key={`bar-group-bar-${barGroup.index}-${bar.index}-${bar.value}-${bar.key}`}>
                        <rect
                          x={bar.x}
                          y={bar.y}
                          width={bar.width}
                          height={bar.height}
                          fill={bar.color}
                          stroke="#18181B"
                          strokeWidth={2}
                          rx={0}
                          className="transition-opacity duration-150 hover:opacity-80 cursor-pointer"
                          onMouseMove={(event) => {
                            const svg = event.currentTarget.ownerSVGElement;
                            const rect = svg.getBoundingClientRect();
                            showTooltip({
                              tooltipLeft: event.clientX - rect.left,
                              tooltipTop: event.clientY - rect.top,
                              tooltipData: {
                                metric: barGroup.x0,
                                key: bar.key,
                                value: bar.value,
                                color: bar.color,
                              },
                            });
                          }}
                          onMouseLeave={hideTooltip}
                        />

                        {/* Direct Percentage Label above each bar */}
                        <text
                          x={bar.x + bar.width / 2}
                          y={bar.y - 6}
                          textAnchor="middle"
                          fontSize={11}
                          fontWeight={900}
                          fill="#18181B"
                          fontFamily="ui-monospace, monospace"
                        >
                          {formattedVal}
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
            stroke="#18181B"
            strokeWidth={2}
            tickStroke="#18181B"
            tickFormat={(v) => `${v}%`}
            tickLabelProps={() => ({
              fill: '#18181B',
              fontSize: 10,
              fontWeight: 800,
              textAnchor: 'end',
              dy: '0.33em',
            })}
          />

          <AxisBottom
            top={yMax}
            scale={x0Scale}
            stroke="#18181B"
            strokeWidth={2}
            tickStroke="#18181B"
            tickLabelProps={() => ({
              fill: '#18181B',
              fontSize: 11,
              fontWeight: 900,
              textAnchor: 'middle',
              dy: '0.25em',
            })}
          />
        </Group>
      </svg>

      {tooltipOpen && tooltipData && (
        <TooltipWithBounds top={tooltipTop} left={tooltipLeft} style={tooltipStyles}>
          <div className="font-mono text-xs">
            <span className="font-black uppercase">{tooltipData.metric}</span>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <span className="w-2.5 h-2.5 border border-white" style={{ backgroundColor: tooltipData.color }} />
              <span className="font-extrabold">{tooltipData.key}:</span>
              <span className="font-black text-[#FAFAFA] font-mono">{tooltipData.value.toFixed(1)}%</span>
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
