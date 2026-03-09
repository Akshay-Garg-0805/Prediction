"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/app/context/AuthContext";

export default function Navbar() {
  const { user, userProfile, signIn, signOut, loading } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 border-b border-white/5"
      style={{ background: "rgba(10,14,26,0.92)", backdropFilter: "blur(20px)" }}>
      
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 group">
        <span className="text-2xl">🏏</span>
        <span className="font-bold text-lg">
          <span className="gradient-text">IPL</span>
          <span className="text-white ml-1 opacity-70">Predict</span>
        </span>
      </Link>

      {/* Links */}
      <div className="hidden md:flex items-center gap-6 text-sm">
        <Link href="/" className="text-gray-400 hover:text-white transition-colors">Home</Link>
        <Link href="/leaderboard" className="text-gray-400 hover:text-white transition-colors">Leaderboard</Link>
        {userProfile?.isAdmin && (
          <Link href="/admin" className="text-yellow-400 hover:text-yellow-300 transition-colors">Admin</Link>
        )}
      </div>

      {/* Auth */}
      <div className="flex items-center gap-3">
        {loading ? (
          <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
        ) : user ? (
          <div className="flex items-center gap-3">
            {user.photoURL && (
              <Image
                src={user.photoURL}
                alt={user.displayName || "User"}
                width={34}
                height={34}
                className="rounded-full ring-2 ring-yellow-400/30"
              />
            )}
            <span className="text-sm text-gray-300 hidden md:block">{user.displayName}</span>
            <button
              onClick={signOut}
              className="text-sm text-gray-400 hover:text-white border border-white/10 px-3 py-1.5 rounded-lg transition-all hover:border-white/30"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button onClick={signIn} className="btn-primary text-sm py-2 px-4">
            Sign in with Google
          </button>
        )}
      </div>
    </nav>
  );
}
