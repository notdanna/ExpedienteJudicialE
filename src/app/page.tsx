import { LoginGate } from '@/components/LoginGate';
import { ExpedienteView } from '@/components/ExpedienteView';

export default function Home() {
  return (
    <LoginGate>
      <ExpedienteView />
    </LoginGate>
  );
}
