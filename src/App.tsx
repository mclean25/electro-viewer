import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { QueryPage } from './pages/QueryPage';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/query/:entityName/:indexName" element={<QueryPage />} />
      </Routes>
    </Layout>
  );
}

export default App;