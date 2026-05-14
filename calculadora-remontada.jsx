import { useState } from "react";

const SYSTEM_PROMPT = `Eres un asistente especializado en cálculo de notas universitarias para estudiantes de Ingeniería Comercial en Chile. El sistema de notas va del 1.0 al 7.0, siendo 4.0 la nota mínima de aprobación.

Cuando el usuario te entregue información sobre sus notas, debes:
1. Calcular su promedio ponderado actual
2. Calcular qué nota necesita en las evaluaciones restantes para aprobar (llegar a 4.0) o para su meta
3. Evaluar si la remontada es matemáticamente posible
4. Dar un veredicto claro y honesto con emojis

Responde siempre en español, de forma directa y con energía. Usa estos niveles:
- ✅ ZONA SEGURA: Ya está aprobado o muy cerca
- ⚡ REMONTADA POSIBLE: Se puede pero hay que ponerse las pilas
- 🔥 MODO DIFÍCIL: Necesita notas muy altas, pero matemáticamente posible
- 💀 MISIÓN IMPOSIBLE: Matemáticamente no es posible aprobar

Al final siempre da un consejo motivacional pero realista.`;

const initialRamos = [
  { id: 1, nombre: "", evaluaciones: [{ nombre: "", nota: "", ponderacion: "" }] },
];

function EvalRow({ ev, onChange, onRemove, canRemove }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
      <input
        placeholder="Ej: Solemne 1"
        value={ev.nombre}
        onChange={(e) => onChange("nombre", e.target.value)}
        style={inputStyle({ flex: 2 })}
      />
      <input
        placeholder="Nota"
        type="number"
        min="1" max="7" step="0.1"
        value={ev.nota}
        onChange={(e) => onChange("nota", e.target.value)}
        style={inputStyle({ width: 72 })}
      />
      <input
        placeholder="% pond."
        type="number"
        min="1" max="100"
        value={ev.ponderacion}
        onChange={(e) => onChange("ponderacion", e.target.value)}
        style={inputStyle({ width: 80 })}
      />
      {canRemove && (
        <button onClick={onRemove} style={btnIcon}>✕</button>
      )}
    </div>
  );
}

function PendienteRow({ ev, onChange, onRemove, canRemove }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
      <input
        placeholder="Ej: Examen Final"
        value={ev.nombre}
        onChange={(e) => onChange("nombre", e.target.value)}
        style={inputStyle({ flex: 2 })}
      />
      <input
        placeholder="% pond."
        type="number"
        min="1" max="100"
        value={ev.ponderacion}
        onChange={(e) => onChange("ponderacion", e.target.value)}
        style={inputStyle({ width: 80 })}
      />
      {canRemove && (
        <button onClick={onRemove} style={btnIcon}>✕</button>
      )}
    </div>
  );
}

export default function CalculadoraRemontada() {
  const [ramos, setRamos] = useState(initialRamos);
  const [meta, setMeta] = useState("4.0");
  const [respuesta, setRespuesta] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [inputUsuario, setInputUsuario] = useState("");

  const addRamo = () => {
    setRamos([...ramos, {
      id: Date.now(),
      nombre: "",
      evaluaciones: [{ nombre: "", nota: "", ponderacion: "" }],
      pendientes: [],
    }]);
  };

  const removeRamo = (id) => setRamos(ramos.filter(r => r.id !== id));

  const updateRamo = (id, field, value) => {
    setRamos(ramos.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const addEval = (ramoId) => {
    setRamos(ramos.map(r => r.id === ramoId
      ? { ...r, evaluaciones: [...(r.evaluaciones || []), { nombre: "", nota: "", ponderacion: "" }] }
      : r
    ));
  };

  const updateEval = (ramoId, idx, field, value) => {
    setRamos(ramos.map(r => {
      if (r.id !== ramoId) return r;
      const evs = [...(r.evaluaciones || [])];
      evs[idx] = { ...evs[idx], [field]: value };
      return { ...r, evaluaciones: evs };
    }));
  };

  const removeEval = (ramoId, idx) => {
    setRamos(ramos.map(r => {
      if (r.id !== ramoId) return r;
      const evs = (r.evaluaciones || []).filter((_, i) => i !== idx);
      return { ...r, evaluaciones: evs };
    }));
  };

  const addPendiente = (ramoId) => {
    setRamos(ramos.map(r => r.id === ramoId
      ? { ...r, pendientes: [...(r.pendientes || []), { nombre: "", ponderacion: "" }] }
      : r
    ));
  };

  const updatePendiente = (ramoId, idx, field, value) => {
    setRamos(ramos.map(r => {
      if (r.id !== ramoId) return r;
      const ps = [...(r.pendientes || [])];
      ps[idx] = { ...ps[idx], [field]: value };
      return { ...r, pendientes: ps };
    }));
  };

  const removePendiente = (ramoId, idx) => {
    setRamos(ramos.map(r => {
      if (r.id !== ramoId) return r;
      const ps = (r.pendientes || []).filter((_, i) => i !== idx);
      return { ...r, pendientes: ps };
    }));
  };

  const buildPrompt = () => {
    let texto = `Meta de aprobación: ${meta}\n\n`;
    ramos.forEach(r => {
      if (!r.nombre) return;
      texto += `RAMO: ${r.nombre}\n`;
      if (r.evaluaciones?.length) {
        texto += `Evaluaciones realizadas:\n`;
        r.evaluaciones.forEach(ev => {
          if (ev.nombre && ev.nota && ev.ponderacion)
            texto += `  - ${ev.nombre}: nota ${ev.nota}, ponderación ${ev.ponderacion}%\n`;
        });
      }
      if (r.pendientes?.length) {
        texto += `Evaluaciones pendientes:\n`;
        r.pendientes.forEach(ev => {
          if (ev.nombre && ev.ponderacion)
            texto += `  - ${ev.nombre}: ponderación ${ev.ponderacion}%\n`;
        });
      }
      texto += "\n";
    });
    return texto;
  };

  const analizar = async () => {
    setCargando(true);
    setError(null);
    setRespuesta(null);

    const prompt = buildPrompt();
    const mensajes = [
      ...historial,
      { role: "user", content: prompt }
    ];

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: mensajes,
        }),
      });
      const data = await res.json();
      const texto = data.content?.map(b => b.text || "").join("") || "Sin respuesta.";
      const nuevoHistorial = [
        ...mensajes,
        { role: "assistant", content: texto }
      ];
      setHistorial(nuevoHistorial);
      setRespuesta(texto);
    } catch (e) {
      setError("Error al conectar con Claude. Intenta de nuevo.");
    }
    setCargando(false);
  };

  const preguntarSeguimiento = async () => {
    if (!inputUsuario.trim()) return;
    setCargando(true);
    setError(null);

    const mensajes = [
      ...historial,
      { role: "user", content: inputUsuario }
    ];

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: mensajes,
        }),
      });
      const data = await res.json();
      const texto = data.content?.map(b => b.text || "").join("") || "Sin respuesta.";
      setHistorial([...mensajes, { role: "assistant", content: texto }]);
      setRespuesta(texto);
      setInputUsuario("");
    } catch (e) {
      setError("Error al conectar con Claude.");
    }
    setCargando(false);
  };

  return (
    <div style={appStyle}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        ::placeholder { color: #555; }
        input:focus { outline: none; border-color: #e8c43a !important; }
        textarea:focus { outline: none; border-color: #e8c43a !important; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0d0d0d; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        .btn-primary:hover { background: #f0d050 !important; transform: translateY(-1px); }
        .btn-secondary:hover { border-color: #e8c43a !important; color: #e8c43a !important; }
        .ramo-card { transition: border-color 0.2s; }
        .ramo-card:hover { border-color: #333 !important; }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 52, color: "#e8c43a", letterSpacing: 3, lineHeight: 1 }}>
          CALCULADORA REMONTADA
        </div>
        <div style={{ color: "#666", fontSize: 14, marginTop: 6, fontFamily: "'DM Sans', sans-serif", letterSpacing: 2, textTransform: "uppercase" }}>
          Powered by Claude · Ingeniería Comercial
        </div>
      </div>

      {/* Meta */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28, background: "#111", border: "1px solid #222", borderRadius: 10, padding: "14px 18px" }}>
        <span style={{ color: "#aaa", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>🎯 META DE NOTA:</span>
        <input
          type="number" min="1" max="7" step="0.1"
          value={meta}
          onChange={e => setMeta(e.target.value)}
          style={{ ...inputStyle({ width: 80 }), fontSize: 20, fontWeight: 600, color: "#e8c43a", textAlign: "center" }}
        />
        <span style={{ color: "#555", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>(mín. 4.0 para aprobar)</span>
      </div>

      {/* Ramos */}
      {ramos.map((ramo, ri) => (
        <div key={ramo.id} className="ramo-card" style={ramoCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <input
              placeholder={`Nombre del ramo ${ri + 1}`}
              value={ramo.nombre}
              onChange={e => updateRamo(ramo.id, "nombre", e.target.value)}
              style={{ ...inputStyle({ flex: 1 }), fontWeight: 600, fontSize: 15, color: "#fff" }}
            />
            {ramos.length > 1 && (
              <button onClick={() => removeRamo(ramo.id)} style={{ ...btnIcon, marginLeft: 10, color: "#e55" }}>🗑</button>
            )}
          </div>

          {/* Evaluaciones realizadas */}
          <div style={{ marginBottom: 12 }}>
            <div style={sectionLabel}>📋 Evaluaciones realizadas</div>
            {(ramo.evaluaciones || []).map((ev, idx) => (
              <EvalRow
                key={idx}
                ev={ev}
                onChange={(f, v) => updateEval(ramo.id, idx, f, v)}
                onRemove={() => removeEval(ramo.id, idx)}
                canRemove={(ramo.evaluaciones || []).length > 1}
              />
            ))}
            <button onClick={() => addEval(ramo.id)} style={btnSmall}>+ agregar evaluación</button>
          </div>

          {/* Evaluaciones pendientes */}
          <div>
            <div style={sectionLabel}>⏳ Evaluaciones pendientes (sin nota aún)</div>
            {(ramo.pendientes || []).map((ev, idx) => (
              <PendienteRow
                key={idx}
                ev={ev}
                onChange={(f, v) => updatePendiente(ramo.id, idx, f, v)}
                onRemove={() => removePendiente(ramo.id, idx)}
                canRemove={true}
              />
            ))}
            <button onClick={() => addPendiente(ramo.id)} style={btnSmall}>+ agregar pendiente</button>
          </div>
        </div>
      ))}

      <button onClick={addRamo} className="btn-secondary" style={btnSecondary}>
        + Agregar ramo
      </button>

      {/* Botón analizar */}
      <button
        onClick={analizar}
        disabled={cargando}
        className="btn-primary"
        style={btnPrimary}
      >
        {cargando ? "⚡ Analizando..." : "🔥 ANALIZAR REMONTADA"}
      </button>

      {/* Respuesta */}
      {error && (
        <div style={{ background: "#1a0a0a", border: "1px solid #e55", borderRadius: 10, padding: 16, color: "#e55", marginTop: 20 }}>
          {error}
        </div>
      )}

      {respuesta && (
        <div style={{ background: "#0d1a0d", border: "1px solid #2a4a2a", borderRadius: 12, padding: 20, marginTop: 20 }}>
          <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 18, color: "#4ade80", letterSpacing: 2, marginBottom: 12 }}>
            VEREDICTO DE CLAUDE
          </div>
          <div style={{ color: "#ccc", fontFamily: "'DM Sans', sans-serif", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
            {respuesta}
          </div>

          {/* Seguimiento */}
          <div style={{ marginTop: 20, borderTop: "1px solid #1a3a1a", paddingTop: 16 }}>
            <div style={{ color: "#666", fontSize: 12, marginBottom: 8, fontFamily: "'DM Sans', sans-serif", letterSpacing: 1 }}>
              PREGÚNTALE A CLAUDE
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={inputUsuario}
                onChange={e => setInputUsuario(e.target.value)}
                onKeyDown={e => e.key === "Enter" && preguntarSeguimiento()}
                placeholder="Ej: ¿Qué pasa si saco un 5.0 en el examen?"
                style={inputStyle({ flex: 1 })}
              />
              <button
                onClick={preguntarSeguimiento}
                disabled={cargando}
                className="btn-primary"
                style={{ ...btnPrimary, marginTop: 0, padding: "10px 20px", fontSize: 13 }}
              >
                {cargando ? "..." : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const appStyle = {
  background: "#0a0a0a",
  minHeight: "100vh",
  padding: "32px 24px",
  maxWidth: 680,
  margin: "0 auto",
  fontFamily: "'DM Sans', sans-serif",
  color: "#fff",
};

const ramoCard = {
  background: "#111",
  border: "1px solid #222",
  borderRadius: 12,
  padding: 18,
  marginBottom: 16,
};

const sectionLabel = {
  color: "#666",
  fontSize: 11,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  marginBottom: 8,
};

const inputStyle = (extra = {}) => ({
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  borderRadius: 6,
  color: "#ddd",
  padding: "8px 12px",
  fontSize: 13,
  fontFamily: "'DM Sans', sans-serif",
  transition: "border-color 0.2s",
  ...extra,
});

const btnIcon = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#555",
  fontSize: 14,
  padding: "4px 6px",
};

const btnSmall = {
  background: "none",
  border: "1px dashed #333",
  color: "#666",
  fontSize: 12,
  padding: "5px 12px",
  borderRadius: 6,
  cursor: "pointer",
  marginTop: 4,
  fontFamily: "'DM Sans', sans-serif",
  transition: "all 0.2s",
};

const btnSecondary = {
  display: "block",
  width: "100%",
  padding: "12px",
  background: "none",
  border: "1px solid #333",
  color: "#aaa",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
  marginBottom: 12,
  fontFamily: "'DM Sans', sans-serif",
  transition: "all 0.2s",
};

const btnPrimary = {
  display: "block",
  width: "100%",
  padding: "16px",
  background: "#e8c43a",
  border: "none",
  color: "#000",
  borderRadius: 10,
  cursor: "pointer",
  fontSize: 16,
  fontWeight: 700,
  fontFamily: "'Bebas Neue', cursive",
  letterSpacing: 2,
  marginTop: 20,
  transition: "all 0.2s",
};
