import React from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { cn } from "@/lib/utils";

interface SummaryChartBackgroundProps {
  data: { name: string; value: number }[];
  colorClass: string; // Ex: 'text-red-500'
  gradientId: string;
}

const SummaryChartBackground: React.FC<SummaryChartBackgroundProps> = ({ data, colorClass, gradientId }) => {
  
  // Cores base (HSL)
  let stopColor = "hsl(var(--primary))"; // Default
  if (colorClass.includes("red")) stopColor = "hsl(0 84.2% 60.2%)"; // Destructive (Vermelho)
  if (colorClass.includes("yellow")) stopColor = "hsl(48 96% 50%)"; // Yellow-500 (Amarelo)
  if (colorClass.includes("green")) stopColor = "hsl(142.1 76.2% 36.3%)"; // Green-500 (Verde)
  if (colorClass.includes("purple")) stopColor = "hsl(271 76% 53%)"; // Purple-500 (Roxo)

  return (
    <div className="absolute inset-0 w-full h-full opacity-20 pointer-events-none z-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          {/* Definição do Degradê (Fade) */}
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={stopColor} stopOpacity={0.8}/>
              <stop offset="95%" stopColor={stopColor} stopOpacity={0}/>
            </linearGradient>
          </defs>
          
          {/* A Área desenhada usando o degradê acima */}
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={stopColor} // Usando a cor HSL diretamente para o stroke
            fillOpacity={1} 
            fill={`url(#${gradientId})`} 
            strokeWidth={2}
            isAnimationActive={false} // Desativa animação para ser mais leve
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SummaryChartBackground;