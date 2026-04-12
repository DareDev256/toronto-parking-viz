"use client";

/**
 * Sun/Moon celestial arc that orbits based on current hour.
 * Sun rises at 6am, peaks at noon, sets at 8pm.
 * Moon fills the night. Ambient sky gradient shifts with time.
 */

interface CelestialClockProps {
  hour: number; // 0-23
  isAnimating: boolean;
}

function getSkyColors(hour: number): { from: string; to: string; opacity: number } {
  if (hour >= 6 && hour < 8) {
    // Dawn
    const t = (hour - 6) / 2;
    return { from: `rgba(255,${140 + t * 60},${50 + t * 50},${0.15 - t * 0.05})`, to: "transparent", opacity: 1 };
  }
  if (hour >= 8 && hour < 17) {
    // Day — very subtle warm wash
    return { from: "rgba(255,220,150,0.03)", to: "transparent", opacity: 1 };
  }
  if (hour >= 17 && hour < 20) {
    // Dusk
    const t = (hour - 17) / 3;
    return { from: `rgba(${200 - t * 100},${100 - t * 60},${150 + t * 50},${0.08 + t * 0.07})`, to: "transparent", opacity: 1 };
  }
  // Night
  return { from: "rgba(20,20,60,0.12)", to: "transparent", opacity: 1 };
}

function getCelestialPosition(hour: number): {
  x: number; // 0-100 percentage across screen
  y: number; // 0-100 percentage (0 = top)
  isSun: boolean;
  glowColor: string;
  size: number;
} {
  const isSun = hour >= 6 && hour < 20;

  if (isSun) {
    // Sun: rises at 6 (left), peaks at 13 (center-top), sets at 20 (right)
    const sunProgress = (hour - 6) / 14; // 0 to 1
    const x = 10 + sunProgress * 80; // 10% to 90%
    // Parabolic arc: lowest at edges, highest at center
    const normalizedX = (sunProgress - 0.5) * 2; // -1 to 1
    const y = 5 + normalizedX * normalizedX * 20; // 5% at peak, 25% at edges
    return {
      x, y, isSun: true,
      glowColor: hour < 8 || hour > 17 ? "rgba(255,160,50,0.8)" : "rgba(255,220,100,0.9)",
      size: hour < 8 || hour > 17 ? 28 : 32,
    };
  } else {
    // Moon: rises at 20, peaks at 1am, sets at 6
    let moonHour = hour >= 20 ? hour - 20 : hour + 4; // 0-10 range
    const moonProgress = moonHour / 10;
    const x = 10 + moonProgress * 80;
    const normalizedX = (moonProgress - 0.5) * 2;
    const y = 5 + normalizedX * normalizedX * 20;
    return {
      x, y, isSun: false,
      glowColor: "rgba(180,200,255,0.6)",
      size: 24,
    };
  }
}

export default function CelestialClock({ hour, isAnimating }: CelestialClockProps) {
  const sky = getSkyColors(hour);
  const body = getCelestialPosition(hour);

  return (
    <>
      {/* Ambient sky gradient */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none transition-all"
        style={{
          background: `linear-gradient(180deg, ${sky.from} 0%, ${sky.to} 40%)`,
          opacity: sky.opacity,
          transitionDuration: isAnimating ? "400ms" : "800ms",
        }}
      />

      {/* Celestial body */}
      <div
        className="absolute z-[2] pointer-events-none"
        style={{
          left: `${body.x}%`,
          top: `${body.y}%`,
          transform: "translate(-50%, -50%)",
          transition: isAnimating ? "all 400ms ease-out" : "all 800ms ease-out",
        }}
      >
        {/* Outer glow */}
        <div
          className="absolute rounded-full"
          style={{
            width: body.size * 3,
            height: body.size * 3,
            left: -(body.size * 3 - body.size) / 2,
            top: -(body.size * 3 - body.size) / 2,
            background: `radial-gradient(circle, ${body.glowColor} 0%, transparent 70%)`,
            filter: "blur(8px)",
          }}
        />
        {/* Core body */}
        <div
          className="rounded-full relative"
          style={{
            width: body.size,
            height: body.size,
            background: body.isSun
              ? "radial-gradient(circle at 35% 35%, #fff5d4 0%, #ffd54f 40%, #ff9800 100%)"
              : "radial-gradient(circle at 65% 35%, #e8eaf6 0%, #9fa8da 50%, #7986cb 100%)",
            boxShadow: body.isSun
              ? "0 0 20px rgba(255,200,50,0.6), 0 0 60px rgba(255,150,0,0.3)"
              : "0 0 15px rgba(180,200,255,0.4), 0 0 40px rgba(130,160,255,0.2)",
          }}
        >
          {/* Moon craters (subtle) */}
          {!body.isSun && (
            <>
              <div className="absolute w-2 h-2 rounded-full bg-white/10" style={{ top: "30%", left: "55%" }} />
              <div className="absolute w-1.5 h-1.5 rounded-full bg-white/10" style={{ top: "55%", left: "35%" }} />
              <div className="absolute w-1 h-1 rounded-full bg-white/10" style={{ top: "40%", left: "70%" }} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
