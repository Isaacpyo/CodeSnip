import React from 'react';
import { Search, Save, Copy, Hash } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#1e1e1e] text-gray-300 font-sans flex flex-col">
      <nav className="h-14 bg-[#252526] border-b border-[#333] flex items-center px-4 justify-between">
        <div className="font-bold text-blue-400 flex items-center gap-2"><Hash /> CodeSnip</div>
        <div className="bg-[#3c3c3c] flex items-center px-3 py-1 rounded w-96 border border-[#555]">
          <Search size={14} className="mr-2" />
          <input type="text" placeholder="Search snippets (e.g., 'React Hook')" className="bg-transparent border-none outline-none text-sm w-full text-white"/>
        </div>
      </nav>

      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-64 bg-[#252526] border-r border-[#333] p-2 overflow-y-auto">
          <div className="text-xs font-bold uppercase text-gray-500 mb-2 px-2 mt-4">Library</div>
          {['Auth Helper', 'React UseFetch', 'Docker Setup', 'AWS S3 Upload'].map((item, i) => (
             <div key={i} className={`px-2 py-1 text-sm rounded cursor-pointer ${i === 1 ? 'bg-[#37373d] text-white' : 'hover:bg-[#2a2d2e]'}`}>
               {item}.ts
             </div>
          ))}
        </div>

        {/* Editor Area */}
        <div className="flex-1 p-0 flex flex-col">
           <div className="h-10 bg-[#1e1e1e] flex items-center px-4 border-b border-[#333] justify-between">
              <span className="text-sm text-white">React UseFetch.ts</span>
              <button className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"><Copy size={12}/> Copy</button>
           </div>
           <div className="flex-1 p-8 font-mono text-sm overflow-auto">
              <pre className="text-blue-300">import <span className="text-white">{</span> useState, useEffect <span className="text-white">}</span> from <span className="text-orange-400">'react'</span>;</pre>
              <pre className="mt-4 text-green-400">// Custom hook for data fetching</pre>
              <pre className="text-purple-400">export const <span className="text-yellow-200">useFetch</span> = (url: string) => {</pre>
              <pre className="pl-4 text-white">const [data, setData] = useState(null);</pre>
              <pre className="pl-4 text-white">...</pre>
              <pre className="text-purple-400">};</pre>
           </div>
        </div>
      </div>
    </main>
  );
}
