// [código, nombre, prefijos telefónicos, región]
export const PAISES = [
  ['US', 'Estados Unidos', ['1'], 'Norteamérica'], ['CA', 'Canadá', ['1'], 'Norteamérica'], ['MX', 'México', ['52'], 'Norteamérica'],
  ['GT', 'Guatemala', ['502'], 'Centroamérica'], ['BZ', 'Belice', ['501'], 'Centroamérica'], ['SV', 'El Salvador', ['503'], 'Centroamérica'],
  ['HN', 'Honduras', ['504'], 'Centroamérica'], ['NI', 'Nicaragua', ['505'], 'Centroamérica'], ['CR', 'Costa Rica', ['506'], 'Centroamérica'],
  ['PA', 'Panamá', ['507'], 'Centroamérica'],
  ['CU', 'Cuba', ['53'], 'Caribe'], ['DO', 'República Dominicana', ['1809', '1829', '1849'], 'Caribe'], ['PR', 'Puerto Rico', ['1787', '1939'], 'Caribe'],
  ['HT', 'Haití', ['509'], 'Caribe'], ['JM', 'Jamaica', ['1876'], 'Caribe'], ['TT', 'Trinidad y Tobago', ['1868'], 'Caribe'],
  ['CO', 'Colombia', ['57'], 'Sudamérica'], ['VE', 'Venezuela', ['58'], 'Sudamérica'], ['EC', 'Ecuador', ['593'], 'Sudamérica'],
  ['PE', 'Perú', ['51'], 'Sudamérica'], ['BO', 'Bolivia', ['591'], 'Sudamérica'], ['CL', 'Chile', ['56'], 'Sudamérica'],
  ['AR', 'Argentina', ['54'], 'Sudamérica'], ['UY', 'Uruguay', ['598'], 'Sudamérica'], ['PY', 'Paraguay', ['595'], 'Sudamérica'],
  ['BR', 'Brasil', ['55'], 'Sudamérica'], ['GY', 'Guyana', ['592'], 'Sudamérica'], ['SR', 'Surinam', ['597'], 'Sudamérica'],
  ['ES', 'España', ['34'], 'Europa'], ['PT', 'Portugal', ['351'], 'Europa'], ['FR', 'Francia', ['33'], 'Europa'], ['IT', 'Italia', ['39'], 'Europa'],
  ['DE', 'Alemania', ['49'], 'Europa'], ['GB', 'Reino Unido', ['44'], 'Europa'], ['NL', 'Países Bajos', ['31'], 'Europa'], ['BE', 'Bélgica', ['32'], 'Europa'],
  ['CH', 'Suiza', ['41'], 'Europa'], ['IE', 'Irlanda', ['353'], 'Europa'], ['SE', 'Suecia', ['46'], 'Europa'], ['NO', 'Noruega', ['47'], 'Europa'],
  ['PL', 'Polonia', ['48'], 'Europa'], ['RO', 'Rumania', ['40'], 'Europa'], ['RU', 'Rusia', ['7'], 'Europa'], ['UA', 'Ucrania', ['380'], 'Europa'],
  ['TR', 'Turquía', ['90'], 'Europa'],
  ['NG', 'Nigeria', ['234'], 'África'], ['ZA', 'Sudáfrica', ['27'], 'África'], ['MA', 'Marruecos', ['212'], 'África'], ['EG', 'Egipto', ['20'], 'África'],
  ['GH', 'Ghana', ['233'], 'África'], ['KE', 'Kenia', ['254'], 'África'], ['DZ', 'Argelia', ['213'], 'África'], ['AO', 'Angola', ['244'], 'África'],
  ['MZ', 'Mozambique', ['258'], 'África'], ['GQ', 'Guinea Ecuatorial', ['240'], 'África'],
  ['IN', 'India', ['91'], 'Asia y Oceanía'], ['PK', 'Pakistán', ['92'], 'Asia y Oceanía'], ['BD', 'Bangladés', ['880'], 'Asia y Oceanía'],
  ['ID', 'Indonesia', ['62'], 'Asia y Oceanía'], ['PH', 'Filipinas', ['63'], 'Asia y Oceanía'], ['VN', 'Vietnam', ['84'], 'Asia y Oceanía'],
  ['CN', 'China', ['86'], 'Asia y Oceanía'], ['JP', 'Japón', ['81'], 'Asia y Oceanía'], ['KR', 'Corea del Sur', ['82'], 'Asia y Oceanía'],
  ['TH', 'Tailandia', ['66'], 'Asia y Oceanía'], ['MY', 'Malasia', ['60'], 'Asia y Oceanía'], ['AE', 'Emiratos Árabes', ['971'], 'Asia y Oceanía'],
  ['SA', 'Arabia Saudita', ['966'], 'Asia y Oceanía'], ['IL', 'Israel', ['972'], 'Asia y Oceanía'], ['AU', 'Australia', ['61'], 'Asia y Oceanía'],
  ['NZ', 'Nueva Zelanda', ['64'], 'Asia y Oceanía'],
  ['XX', 'Cualquier otro país no listado', [], 'Otros']
];

// Devuelve los códigos de país que corresponden al teléfono (prefijo más largo que coincida).
export function paisesDe(telefono) {
  const t = String(telefono || '').replace(/\D/g, '');
  let largo = 0, hallados = [];
  for (const [iso, , prefijos] of PAISES) {
    for (const p of prefijos) {
      if (!t.startsWith(p)) continue;
      if (p.length > largo) { largo = p.length; hallados = [iso]; }
      else if (p.length === largo) hallados.push(iso);
    }
  }
  return hallados.length ? hallados : ['XX'];
}

export function estaBloqueado(bot, telefono) {
  const lista = bot.paisesBloqueados || [];
  if (!lista.length || !telefono) return false;
  return paisesDe(telefono).some(iso => lista.includes(iso));
}
