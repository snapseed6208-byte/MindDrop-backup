import { useState } from 'react';
import type { MindDropRecord } from './types';
import { useRecords } from './hooks';
import { useAuth } from './hooks/useAuth';
import Home from './pages/Home';
import CreateRecord from './pages/CreateRecord';
import RecordDetail from './pages/RecordDetail';

type Page =
  | { name: 'home' }
  | { name: 'create' }
  | { name: 'detail'; record: MindDropRecord };

export default function App() {
  const { records, add, update, remove, reload } = useRecords();
  const auth = useAuth();

  const [page, setPage] = useState<Page>({ name: 'home' });

  const navigate = (name: string, record?: MindDropRecord) => {
    if (name === 'create') setPage({ name: 'create' });
    else if (name === 'detail' && record) setPage({ name: 'detail', record });
    else setPage({ name: 'home' });
  };

  const handleCreate = (record: MindDropRecord) => {
    add(record);
    setPage({ name: 'home' });
  };

  const handleUpdate = (record: MindDropRecord) => {
    update(record);
    setPage({ name: 'detail', record });
  };

  const handleDelete = (id: string) => {
    remove(id);
    setPage({ name: 'home' });
  };

  switch (page.name) {
    case 'create':
      return <CreateRecord onSave={handleCreate} onCancel={() => setPage({ name: 'home' })} />;
    case 'detail':
      return (
        <RecordDetail
          record={page.record}
          onSave={handleUpdate}
          onDelete={handleDelete}
          onBack={() => setPage({ name: 'home' })}
        />
      );
    default:
      return (
        <Home
          records={records}
          onNavigate={navigate}
          onEdit={(r) => setPage({ name: 'detail', record: r })}
          onReload={reload}
          auth={auth}
        />
      );
  }
}
