import { createContext, useContext, useRef, useState } from 'react';
import { clinicTransition } from './clinic';
const Context = createContext(null);
// In-memory demo only: never store patient details in localStorage.
export function ClinicProvider({ children }) {
  const current = useRef({ bookings: [], nextId: 1 });
  const [state, setState] = useState(current.current);
  const [draft, setDraft] = useState({});
  function act(action) {
    const next = clinicTransition(current.current, action);
    current.current = next;
    setState(next);
    return next.bookings.at(-1)?.id;
  }
  return <Context.Provider value={{ ...state, act, draft, setDraft }}>{children}</Context.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useClinic() { return useContext(Context); }
