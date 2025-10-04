import Home from './Home';
import { Toaster } from '@/components/ui/sonner';

function App() {
  return (
    <div>
      <Home />
      <Toaster position="top-right" richColors />
    </div>
  )
}

export default App;