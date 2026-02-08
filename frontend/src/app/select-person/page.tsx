"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");
}

const PROFILES = [
  {
    name: "Warren Buffett",
    image: "/profile1.jpg",
    description: "Long-term value investor focused on strong fundamentals and durable businesses."
  },
  {
    name: "Cathie Wood",
    image: "/profile2.jpg",
    description: "High-risk, high-growth investor focused on disruptive innovation and technology."
  },
  {
    name: "Michael Burry",
    image: "/profile3.jpg",
    description: "Contrarian investor who looks for mispriced and distressed opportunities."
  }
];

export default function SelectPersonPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filteredProfiles = PROFILES.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 relative">
      {/* Back Button */}
      <button
        onClick={() => router.push("/")}
        className="
          absolute top-8 right-8
          px-4 py-2 rounded-lg text-sm font-medium
          border transition-colors
          bg-white text-gray-900 border-gray-300 hover:bg-gray-100
          dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 dark:hover:bg-gray-800
        "
      >
        Back
      </button>

      <h1 className="text-5xl font-bold mb-8">
        Select a person
      </h1>

      {/* Search Bar */}
      <input
        type="text"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="
          mb-10 px-4 py-2 w-[500px] rounded-lg
          border border-gray-300
          focus:outline-none focus:ring-2 focus:ring-black
          dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100
          dark:focus:ring-gray-400
        "
      />

      {/* Profiles */}
      <div className="flex flex-row gap-16 mb-10">
        {filteredProfiles.map((profile) => (
          <div
            key={profile.name}
            onClick={() =>
              router.push(`/profile/${slugify(profile.name)}`)
            }
            className="relative group flex flex-col items-center cursor-pointer"
          >
            <img
              src={profile.image}
              alt={profile.name}
              className="
                w-40 h-40 rounded-full object-cover mb-2
                border-2 border-gray-300
                dark:border-gray-700
              "
            />

            <span className="text-xl font-medium">
              {profile.name}
            </span>

            {/* Hover description */}
            <div
              className="
                pointer-events-none
                absolute
                top-full
                mt-4
                w-72

                opacity-0
                translate-y-2
                scale-95

                group-hover:opacity-100
                group-hover:translate-y-0
                group-hover:scale-100

                transition-all duration-200 ease-out

                rounded-xl
                border
                shadow-xl
                p-4
                text-center
                text-sm

                bg-white text-gray-800 border-gray-200
                dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700
              "
            >
              {profile.description}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}