import React from 'react';
import { Bar } from '@visx/shape';
import { Group } from '@visx/group';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { scaleBand, scaleLinear } from '@visx/scale';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { LinearGradient } from '@visx/gradient';
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

function ExceptionBarChartInner({ width, height, exceptionsList = [] }) {
  const {
    tooltipOpen,
    tooltipLeft,
    tooltipTop,
    tooltipData,
    hideTooltip,
    showTooltip,
  } = useTooltip();

  // Aggregate exceptions by operational category
  const counts = {};
  exceptionsList.forEach((e) => {
    const cat = e.category ? e.category.replace(/_/g, ' ') : 'OTHER';
    counts[cat] = (counts[cat] || 0) + 1;
  });

  // Convert to array and sort descending by count
  const data = Object.keys(counts)
    .map((cat) => ({ category: cat, count: counts[cat] }))
    .sort((a, b) => b.count - a.count);

  if (width < 10 || height < 10) return null;

  const margin = { top: 10, right: 35, bottom: 25, left: 160 };
  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;

  // Scales
  const yScale = scaleBand({
    domain: data.map((d) => d.category),
    range: [0, yMax],
    padding: 0.3,
  });

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const xScale = scaleLinear({
    domain: [0, maxCount * 1.15],
    range: [0, Math.max(xMax, 10)],
  });

  return (
    <div className="relative w-full h-full">
      <svg width={width} height={height}>
        <LinearGradient id="red-bar-gradient" from="#EF4444" to="#991B1B" />
        <Group top={margin.top} left={margin.left}>
          {data.map((d) => {
            const barWidth = xScale(d.count);
            const barHeight = yScale.bandwidth();
            const barY = yScale(d.category);

            return (
              <Group key={d.category}>
                <Bar
                  x={0}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                  fill="url(#red-bar-gradient)"
                  rx={4}
                  className="transition-all duration-200 hover:opacity-85 cursor-pointer"
                  onMouseMove={(event) => {
                    const svg = event.currentTarget.ownerSVGElement;
                    const rect = svg.getBoundingClientRect();
                    showTooltip({
                      tooltipLeft: event.clientX - rect.left,
                      tooltipTop: event.clientY - rect.top,
                      tooltipData: d,
                    });
                  }}
                  onMouseLeave={hideTooltip}
                />
                {/* Count label at end of bar */}
                <text
                  x={barWidth + 6}
                  y={barY + barHeight / 2}
                  dy="0.35em"
                  fontSize={11}
                  fontWeight={600}
                  fill="#0B1F3A"
                  className="font-mono-tabular"
                >
                  {d.count}
                </text>
              </Group>
            );
          })}

          <AxisLeft
            scale={yScale}
            stroke="transparent"
            tickStroke="transparent"
            tickLabelProps={() => ({
              fill: '#475569',
              fontSize: 10,
              fontWeight: 500,
              textAnchor: 'end',
              dy: '0.33em',
            })}
          />

          <AxisBottom
            top={yMax}
            scale={xScale}
            stroke="#CBD5E1"
            tickStroke="#CBD5E1"
            numTicks={Math.min(maxCount, 5)}
            tickLabelProps={() => ({
              fill: '#64748B',
              fontSize: 10,
              textAnchor: 'middle',
            })}
          />
        </Group>
      </svg>

      {tooltipOpen && tooltipData && (
        <TooltipWithBounds top={tooltipTop} left={tooltipLeft} style={tooltipStyles}>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
            <span className="font-semibold">{tooltipData.category}:</span>
            <span className="font-mono-tabular font-bold">{tooltipData.count} exception(s)</span>
          </div>
        </TooltipWithBounds>
      )}
    </div>
  );
}

export function ExceptionBarChart(props) {
  return (
    <ParentSize>
      {({ width, height }) => <ExceptionBarChartInner width={width} height={height} {...props} />}
    </ParentSize>
  );
}
