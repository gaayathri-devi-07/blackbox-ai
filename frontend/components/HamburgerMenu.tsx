"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Home, LayoutDashboard, User, LogOut } from "lucide-react";
import { auth, signOut } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function HamburgerMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut();
    setIsOpen(false);
    router.push("/landing");
  };

  const menuItems = [
    { icon: Home, label: "Home", href: "/journey" },
    { icon: LayoutDashboard, label: "Dashboard", href: "/home" },
    { icon: User, label: "Profile", href: "/profile" },
  ];

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 right-4 z-[9997] w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center transition-all"
        aria-label="Menu"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <Menu className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9996]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />

            {/* Drawer Panel */}
            <motion.div
              className="fixed top-0 right-0 h-full w-72 bg-[#0A0A0F] border-l border-white/10 z-[9998] flex flex-col shadow-2xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              {/* Header */}
              <div className="p-6 border-b border-white/10">
                <h2 className="text-xl font-bold text-white mb-1">Menu</h2>
                {user && (
                  <p className="text-sm text-white/50 truncate">
                    {user.displayName || user.email}
                  </p>
                )}
              </div>

              {/* Menu Items */}
              <nav className="flex-1 p-4 space-y-2">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  
                  return (
                    <button
                      key={item.href}
                      onClick={() => {
                        router.push(item.href);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                        isActive
                          ? "bg-white/10 text-white"
                          : "text-white/60 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Logout */}
              {user && (
                <div className="p-4 border-t border-white/10">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Logout</span>
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
