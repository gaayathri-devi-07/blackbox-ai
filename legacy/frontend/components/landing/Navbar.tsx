"use client";

import { useLenis } from "@studio-freight/react-lenis";

export default function Navbar() {
  const lenis = useLenis();

  const handleScroll = (
    e: React.MouseEvent<HTMLAnchorElement>,
    targetId: string
  ) => {
    e.preventDefault();
    if (lenis) {
      lenis.scrollTo(targetId, {
        offset: 0,
        duration: 1.5,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      });
    }
  };

  return (
    <header className="fixed top-0 left-0 w-full z-[9990] pointer-events-none px-6 py-8">
      <nav className="max-w-[1400px] mx-auto flex justify-between items-center pointer-events-auto">
        <ul className="flex gap-6 sm:gap-8 items-center">
          {["Home", "About", "Projects", "Internships", "Skills", "Contact"].map(
            (item) => {
              const targetId = `#${item.toLowerCase()}`;
              return (
                <li key={item}>
                  <a
                    href={targetId}
                    onClick={(e) => handleScroll(e, targetId)}
                    className="magnetic-item block px-3 py-2 text-xs sm:text-sm font-mono text-[#ffffff] tracking-[0.2em] uppercase hover:text-[#FFB6C1] transition-colors"
                  >
                    {item}
                  </a>
                </li>
              );
            }
          )}
        </ul>
      </nav>
    </header>
  );
}
