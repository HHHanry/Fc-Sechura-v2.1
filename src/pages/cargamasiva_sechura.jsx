import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const jugadores = [
  {
    nombre: 'Wilmer Gabriel',
    apellido: 'Querevalu Tume',
    fechaNacimiento: '2012-02-13',
    categoria: '2012',
    dni: '63146153',
    edad: '14',
    colegio: 'I.E.P San Vicente de Paul',
    celular: '928033585',
    apoderado: 'Mercedes Maria Tume Eca',
    celularApoderado: '941113974',
    direccion: 'Cesar Pinglo segunda cuadra',
  },
  {
    nombre: 'Mathias Emanuel',
    apellido: 'Llenque Llenque',
    fechaNacimiento: '2011-06-19',
    categoria: '15',
    dni: '62791867',
    edad: '14',
    colegio: 'Euler',
    celular: '',
    apoderado: 'Manuel Llenque Fiestas',
    celularApoderado: '937245195',
    direccion: 'Cesar Pinglo 515',
  },
  {
    nombre: 'Jesus Alessio',
    apellido: 'Eche Paiba',
    fechaNacimiento: '2011-07-19',
    categoria: '15',
    dni: '62937126',
    edad: '14',
    colegio: 'Euler',
    celular: '991841546',
    apoderado: 'July Paiba Durand',
    celularApoderado: '951652899',
    direccion: 'Av. Los Pinos 216',
  },
  {
    nombre: 'Gonzalo Adrian',
    apellido: 'Puescas Fiestas',
    fechaNacimiento: '2011-01-26',
    categoria: '15',
    dni: '62697226',
    edad: '15',
    colegio: 'CEP Albert Einstein',
    celular: '904278924',
    apoderado: 'Emilia Gabriela Fiestas Martinez',
    celularApoderado: '933543347',
    direccion: 'Asentamiento humano San Martin, Mz. H Lt. 13',
  },
  {
    nombre: 'Dayiro Osniel',
    apellido: 'Gonzales Laiza',
    fechaNacimiento: '2012',
    categoria: '15',
    dni: '63145329',
    edad: '14',
    colegio: 'Sagrado Corazon de Jesus',
    celular: '933099339',
    apoderado: 'Ines Laiza Uribe',
    celularApoderado: '923525149',
    direccion: 'Nuevo Bazan Mz. C, Lote 14',
  },
  {
    nombre: 'Neymar Snayder',
    apellido: 'Silva Torres',
    fechaNacimiento: '2014-05-22',
    categoria: 'Sub 14',
    dni: '78637056',
    edad: '11',
    colegio: 'IEP Isaac Newton',
    celular: '902136728',
    apoderado: 'Herlinda Micaela Torres Cunias',
    celularApoderado: '902136728',
    direccion: 'HH. 28 de Julio, Mz. D Lote 14',
  },
  {
    nombre: 'Jesus Jhampier',
    apellido: 'Ruiz Valle',
    fechaNacimiento: '2013-01-18',
    categoria: 'Sub 13',
    dni: '81080137',
    edad: '13',
    colegio: 'San Jacinto',
    celular: '',
    apoderado: 'Maribel del Socorro Valle Fiestas',
    celularApoderado: '904064582',
    direccion: '',
  },
  {
    nombre: 'Carlos Gabriel',
    apellido: 'Panta Salas',
    fechaNacimiento: '2013-12-16',
    categoria: '13',
    dni: '78577247',
    edad: '12',
    colegio: 'I.E.P Albert Einstein',
    celular: '',
    apoderado: 'Carlos Alberto Panta Ruiz',
    celularApoderado: '993681772',
    direccion: 'Los Jardines Mz. L Lote 15',
  },
  {
    nombre: 'Marcos David',
    apellido: 'Rumiche Fiestas',
    fechaNacimiento: '2013-05-18',
    categoria: '13',
    dni: '78137040',
    edad: '13',
    colegio: 'I.E Sechura',
    celular: '',
    apoderado: 'Freddy Orlando Rumiche Bayona',
    celularApoderado: '933072158',
    direccion: 'Las Mercedes Mz. N Lote 22',
  },
  {
    nombre: 'Juaquin Josue',
    apellido: 'Llenque Pazo',
    fechaNacimiento: '2013-07-13',
    categoria: '13',
    dni: '78177639',
    edad: '12',
    colegio: 'San Martin',
    celular: '',
    apoderado: 'Henry Luis Llenque Fiestas',
    celularApoderado: '912494276',
    direccion: 'Calle Huascar',
  },
  {
    nombre: 'Dayiro Snayder',
    apellido: 'Querevalu Fiestas',
    fechaNacimiento: '2013-08-01',
    categoria: '2013',
    dni: '78212800',
    edad: '12',
    colegio: 'I.E Nacional Sechura',
    celular: '938553236',
    apoderado: 'Cynthia Fiestas Fiestas',
    celularApoderado: '',
    direccion: 'Las Mercedes Mz. N Lote 14',
  },
  {
    nombre: 'James Milner',
    apellido: 'Paz Adriano',
    fechaNacimiento: '2014-09-21',
    categoria: '12',
    dni: '78805570',
    edad: '11',
    colegio: 'Isaac Newton',
    celular: '905998244',
    apoderado: 'Edgar Paz Pena',
    celularApoderado: '931042754',
    direccion: 'Ampliacion Villa Canada Mz. A Lt. 21',
  },
  {
    nombre: 'Jose Israel',
    apellido: 'Sanchez Flores',
    fechaNacimiento: '2012',
    categoria: '',
    dni: '63192537',
    edad: '14',
    colegio: 'Sagrado Corazon de Jesus',
    celular: '',
    apoderado: 'Santos Sanchez Morales',
    celularApoderado: '934915321',
    direccion: '',
  },
  {
    nombre: 'Estharly Addarly',
    apellido: 'Tume Sanchez',
    fechaNacimiento: '2011-12-02',
    categoria: '15',
    dni: '62791490',
    edad: '15',
    colegio: 'Albert Einstein',
    celular: '933003952',
    apoderado: 'Roberto Tume Matta',
    celularApoderado: '923825153',
    direccion: '3 de Enero segunda etapa manzana G',
  },
  {
    nombre: 'Jean Carlos',
    apellido: 'Alvarez Puyo',
    fechaNacimiento: '2011-05-24',
    categoria: '15',
    dni: '62791749',
    edad: '14',
    colegio: 'Euler',
    celular: '968960060',
    apoderado: 'Iris Puyo Ramirez',
    celularApoderado: '981513092',
    direccion: '3 de Enero manzana D lote 3',
  },
  {
    nombre: 'Daniel Amin',
    apellido: 'Najar Castillo',
    fechaNacimiento: '2011',
    categoria: '15',
    dni: '76717659',
    edad: '15',
    colegio: 'Sagrado Corazon de Jesus',
    celular: '960869205',
    apoderado: 'Uliana Castillo Navarro',
    celularApoderado: '983568883',
    direccion: 'Victor Raul calle Los Cocos 406 Mz. O Lote 3',
  },
  {
    nombre: 'Frank Lessner',
    apellido: 'Eche Fiestas',
    fechaNacimiento: '2013-05-25',
    categoria: '13',
    dni: '78138646',
    edad: '13',
    colegio: 'San Martin',
    celular: '',
    apoderado: 'Lelia Del Carmen Fiestas Tume',
    celularApoderado: '942532550',
    direccion: '',
  },
];

const fechaLima = () => {
  const opciones = { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' };
  const partes = new Intl.DateTimeFormat('es-PE', opciones).formatToParts(new Date());
  const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
};

const CargaMasivaSechura = () => {
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState('');

  const ejecutarCarga = async () => {
    setCargando(true);
    setResultado('Iniciando carga de jugadores de Sechura...');

    const alumnosCollectionRef = collection(db, 'alumnos');
    const hoy = fechaLima();
    let agregados = 0;
    let errores = 0;

    for (const jugador of jugadores) {
      const nuevoAlumnoData = {
        ...jugador,
        posicion: '',
        distrito: 'Sechura',
        ciudad: 'Sechura',
        foto: null,
        fechaInscripcion: hoy,
        vencimientoMensualidad: hoy,
        createdAt: serverTimestamp(),
      };

      try {
        await addDoc(alumnosCollectionRef, nuevoAlumnoData);
        agregados += 1;
        setResultado(`Cargados: ${agregados} / ${jugadores.length}`);
      } catch (error) {
        console.error('Error al agregar a', `${jugador.nombre} ${jugador.apellido}`, error);
        errores += 1;
      }
    }

    setCargando(false);
    setResultado(`Carga completada. Agregados: ${agregados}. Errores: ${errores}. Distrito: Sechura.`);
  };

  return (
    <div className="container py-5 text-center mt-5">
      <div className="card shadow-lg p-5 border-0 rounded-4 mx-auto" style={{ maxWidth: '680px' }}>
        <h2 className="fw-black text-primary mb-3">Herramienta de Carga Masiva (Sechura)</h2>
        <p className="text-muted mb-4">
          Se van a cargar <strong>{jugadores.length}</strong> jugadores a la base de datos.
        </p>

        {resultado && (
          <div className={`alert ${cargando ? 'alert-warning' : 'alert-success'} fw-bold mb-4`}>
            {resultado}
          </div>
        )}

        <button
          className="btn btn-danger btn-lg rounded-pill px-5 fw-bold shadow"
          onClick={ejecutarCarga}
          disabled={cargando}
        >
          {cargando ? (
            <>
              <span className="spinner-border spinner-border-sm me-2"></span>
              Cargando a Firebase...
            </>
          ) : (
            <>Iniciar Carga (Distrito: Sechura)</>
          )}
        </button>
      </div>
    </div>
  );
};

export default CargaMasivaSechura;
