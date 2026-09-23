import React, { useState } from 'react';
import { Columns, List } from 'lucide-react';

const mockBaseStatutes = [
  { id: 'art1', title: 'Artículo 1: Naturaleza', content: 'La mutual es una entidad sin fines de lucro enfocada en el bienestar de sus asociados originales.' },
  { id: 'art2', title: 'Artículo 2: Domicilio', content: 'El domicilio legal se establece en la ciudad de origen.' },
  { id: 'art3', title: 'Artículo 3: Patrimonio', content: 'El patrimonio se constituye por el aporte mensual de 10 unidades de valor por miembro.' },
  { id: 'art4', title: 'Artículo 4: Asamblea', content: 'La Asamblea General Ordinaria se reunirá una vez al año.' }
];

const mockProposedStatutes = [
  { id: 'art1', title: 'Artículo 1: Naturaleza y Objeto', content: 'La mutual es una entidad sin fines de lucro enfocada en el bienestar de sus asociados originales y de aquellos incorporados mediante procesos de fusión solidaria.' },
  { id: 'art2', title: 'Artículo 2: Domicilio y Sedes', content: 'El domicilio legal se establece en la ciudad de origen, pudiendo establecer sedes regionales en las zonas de las mutuales absorbidas.' },
  { id: 'art3', title: 'Artículo 3: Patrimonio Unificado', content: 'El patrimonio se constituye por el aporte mensual de 12 unidades de valor por miembro, más los fondos fiduciarios integrados en fusiones.' },
  { id: 'art4', title: 'Artículo 4: Asambleas Anuales', content: 'La Asamblea General Ordinaria se reunirá una vez al año de forma presencial o telemática.' },
  { id: 'art5', title: 'Artículo 5: Representación Regional', content: 'Se establece un consejo consultivo con representantes de cada sede regional.' }
];

// Simple naive word diffing function for demo purposes
const computeDiff = (oldText, newText) => {
  if (!oldText || !newText) return { oldWords: [], newWords: [] };
  
  const oldArr = oldText.split(' ');
  const newArr = newText.split(' ');
  
  // Very naive diff: just checking if the word exists at the exact same index
  const resultOld = oldArr.map((word, i) => ({
    text: word,
    type: word === newArr[i] ? 'unchanged' : 'removed'
  }));
  
  const resultNew = newArr.map((word, i) => ({
    text: word,
    type: word === oldArr[i] ? 'unchanged' : 'added'
  }));
  
  return { oldWords: resultOld, newWords: resultNew };
};

export default function DiffViewer() {
  const [leftArticleId, setLeftArticleId] = useState(mockBaseStatutes[0].id);
  const [rightArticleId, setRightArticleId] = useState(mockProposedStatutes[0].id);
  const [splitView, setSplitView] = useState(true);

  const leftArticle = mockBaseStatutes.find(a => a.id === leftArticleId);
  const rightArticle = mockProposedStatutes.find(a => a.id === rightArticleId);
  
  const { oldWords, newWords } = computeDiff(leftArticle?.content, rightArticle?.content);

  return (
    <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden flex flex-col shadow-2xl">
      {/* Header and Controls */}
      <div className="bg-white/5 p-4 border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
        <h3 className="text-white font-bold flex items-center gap-2">
          <Columns size={18} className="text-purple-400" />
          Comparador Interactivo de Estatutos
        </h3>
        
        <div className="flex bg-black/50 p-1 rounded-lg border border-white/10">
          <button 
            className={`px-3 py-1 text-sm rounded-md flex items-center gap-1 ${splitView ? 'bg-purple-600 text-white shadow-lg' : 'text-secondary hover:text-white'}`}
            onClick={() => setSplitView(true)}
          >
            <Columns size={14} /> Lado a Lado
          </button>
          <button 
            className={`px-3 py-1 text-sm rounded-md flex items-center gap-1 ${!splitView ? 'bg-purple-600 text-white shadow-lg' : 'text-secondary hover:text-white'}`}
            onClick={() => setSplitView(false)}
          >
            <List size={14} /> Unificado
          </button>
        </div>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/10 border-b border-white/10">
        <div className="bg-[#111] p-4">
          <label className="block text-xs font-bold text-red-400 uppercase tracking-wider mb-2">Estatuto Base (Actual)</label>
          <select 
            className="w-full bg-black border border-white/20 text-white rounded p-2 text-sm focus:border-red-400 focus:outline-none"
            value={leftArticleId}
            onChange={(e) => setLeftArticleId(e.target.value)}
          >
            {mockBaseStatutes.map(art => (
              <option key={art.id} value={art.id}>{art.title}</option>
            ))}
          </select>
        </div>
        
        <div className="bg-[#111] p-4">
          <label className="block text-xs font-bold text-green-400 uppercase tracking-wider mb-2">Nuevo Estatuto (Propuesto)</label>
          <select 
            className="w-full bg-black border border-white/20 text-white rounded p-2 text-sm focus:border-green-400 focus:outline-none"
            value={rightArticleId}
            onChange={(e) => setRightArticleId(e.target.value)}
          >
            {mockProposedStatutes.map(art => (
              <option key={art.id} value={art.id}>{art.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Diff Viewer Area */}
      <div className="p-4 bg-[#0a0a0a] min-h-[200px]">
        {splitView ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded-lg border border-red-500/20 bg-red-950/20">
              <h4 className="font-bold text-red-300 mb-2">{leftArticle?.title}</h4>
              <p className="text-secondary leading-relaxed font-serif text-sm">
                {oldWords.map((w, i) => (
                  <span key={i} className={w.type === 'removed' ? 'bg-red-900/50 text-red-200 line-through' : 'text-white'}>
                    {w.text}{' '}
                  </span>
                ))}
              </p>
            </div>
            
            <div className="p-4 rounded-lg border border-green-500/20 bg-green-950/20">
              <h4 className="font-bold text-green-300 mb-2">{rightArticle?.title}</h4>
              <p className="text-secondary leading-relaxed font-serif text-sm">
                {newWords.map((w, i) => (
                  <span key={i} className={w.type === 'added' ? 'bg-green-900/50 text-green-200 font-bold' : 'text-white'}>
                    {w.text}{' '}
                  </span>
                ))}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-lg border border-white/10 bg-[#111] max-w-3xl mx-auto">
            <h4 className="font-bold text-white mb-4 text-center">Vista Unificada</h4>
            <div className="space-y-4">
              <div className="p-3 border-l-4 border-red-500 bg-red-950/10">
                <p className="text-xs text-red-400 font-bold mb-1">ORIGINAL: {leftArticle?.title}</p>
                <p className="text-red-200 text-sm line-through opacity-70">{leftArticle?.content}</p>
              </div>
              
              <div className="p-3 border-l-4 border-green-500 bg-green-950/10">
                <p className="text-xs text-green-400 font-bold mb-1">PROPUESTO: {rightArticle?.title}</p>
                <p className="text-green-200 text-sm">{rightArticle?.content}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
