export function GrowthRings({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 760 640"
      fill="none"
      aria-hidden="true"
      className={className}
      preserveAspectRatio="xMidYMid slice"
    >
      <g stroke="currentColor" strokeWidth="1">
        <path d="M393 138c92 2 169 51 206 128 45 92 57 196-9 275-65 78-191 98-294 52C187 547 122 469 132 369c9-92 78-171 170-208 30-12 61-20 91-23Z" opacity=".38" />
        <path d="M379 176c79 0 146 41 178 108 38 78 49 169-7 237-57 69-167 85-256 45-86-39-143-106-136-191 8-79 68-147 147-179 25-10 50-17 74-20Z" opacity=".3" />
        <path d="M368 215c65 0 122 35 149 91 31 65 40 141-6 198-47 58-139 71-214 37-72-33-119-89-114-160 7-66 57-123 123-150 21-8 42-14 62-16Z" opacity=".25" />
        <path d="M357 254c53 1 99 28 120 74 26 52 32 113-4 159-38 47-113 57-173 30-59-27-97-72-92-130 5-53 46-99 100-121 17-7 33-11 49-12Z" opacity=".2" />
        <path d="M346 293c40 1 75 22 91 56 19 39 24 86-3 120-29 35-85 43-130 22-44-20-73-55-69-98 4-40 35-75 76-91 12-6 24-9 35-9Z" opacity=".15" />
      </g>
      <path
        d="M421 158c58 26 107 71 128 132 21 59 18 128-18 178-36 49-101 71-159 60-59-11-110-50-132-106-22-56-15-121 22-169 36-47 98-75 159-95Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="2 10"
        strokeLinecap="round"
        opacity=".7"
      />
      <circle cx="468" cy="238" r="4" fill="currentColor" />
      <circle cx="245" cy="386" r="3" fill="currentColor" opacity=".6" />
      <circle cx="392" cy="529" r="3.5" fill="currentColor" opacity=".5" />
    </svg>
  );
}
