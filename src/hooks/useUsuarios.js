import { useQuery } from './useFirestoreCache';
import { usuariosService } from '../services/usuariosService';

const KEY = 'usuarios';

export const useUsuarios = () => {
  const q = useQuery(KEY, usuariosService.listar);
  return { usuarios: q.data ?? [], loading: q.loading, error: q.error, refetch: q.refetch };
};
