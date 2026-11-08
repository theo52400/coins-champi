// Sonde : structure de TAXREF sur GBIF, noms français, clés, photos, Wikipédia
import { writeFileSync } from 'node:fs';
const UA = { 'User-Agent': 'CoinsAChampi/1.0 (https://github.com/theo52400/coins-champi)' };
const j = async u => { const r = await fetch(u, { headers: UA }); const t = await r.text(); try { return JSON.parse(t); } catch { return { status: r.status, text: t.slice(0, 500) }; } };
const out = {};
const DS = '0e61f8fe-7d25-4f81-ada7-d970bbb2c6d6';
out.dataset = await j('https://api.gbif.org/v1/dataset/' + DS);
out.dataset = { title: out.dataset.title, modified: out.dataset.modified, pubDate: out.dataset.pubDate, endpoints: out.dataset.endpoints, description: (out.dataset.description || '').slice(0, 400) };
out.kingdom = await j('https://api.gbif.org/v1/species/search?datasetKey=' + DS + '&rank=KINGDOM&limit=20');
out.kingdom = (out.kingdom.results || []).map(r => ({ key: r.key, name: r.scientificName, taxonID: r.taxonID }));
const fk = out.kingdom.find(k => /fungi/i.test(k.name));
if (fk) {
  const s = await j('https://api.gbif.org/v1/species/search?datasetKey=' + DS + '&higherTaxonKey=' + fk.key + '&rank=SPECIES&status=ACCEPTED&limit=3&q=umbellatus');
  out.sample = s.results; out.countSpeciesQ = s.count;
  const all = await j('https://api.gbif.org/v1/species/search?datasetKey=' + DS + '&higherTaxonKey=' + fk.key + '&rank=SPECIES&status=ACCEPTED&limit=0');
  out.countSpecies = all.count;
  const pg = await j('https://api.gbif.org/v1/species/search?datasetKey=' + DS + '&higherTaxonKey=' + fk.key + '&rank=SPECIES&status=ACCEPTED&limit=1000&offset=0');
  out.page0 = { n: pg.results.length, endOfRecords: pg.endOfRecords, withFr: pg.results.filter(r => (r.vernacularNames || []).some(v => /fr/.test(v.language || ''))).length,
    langs: [...new Set(pg.results.flatMap(r => (r.vernacularNames || []).map(v => v.language)))], ex: pg.results.filter(r => (r.vernacularNames || []).length).slice(0, 3) };
  const deep = await j('https://api.gbif.org/v1/species/search?datasetKey=' + DS + '&higherTaxonKey=' + fk.key + '&rank=SPECIES&status=ACCEPTED&limit=1000&offset=20000');
  out.deep = { n: (deep.results || []).length, status: deep.status, text: deep.text };
  if (out.sample && out.sample[0]) {
    const k = out.sample[0].key;
    out.usage = await j('https://api.gbif.org/v1/species/' + k);
    out.vern = await j('https://api.gbif.org/v1/species/' + k + '/vernacularNames');
    out.distrib = await j('https://api.gbif.org/v1/species/' + k + '/distributions');
    out.syn = await j('https://api.gbif.org/v1/species/' + k + '/synonyms?limit=20');
  }
}
out.match = await j('https://api.gbif.org/v1/species/match?name=Polyporus%20umbellatus&kingdom=Fungi');
const key = out.match.speciesKey || out.match.usageKey;
out.month = await j('https://api.gbif.org/v1/occurrence/search?country=FR&taxonKey=' + key + '&facet=month&facet=gadmLevel2Gid&facetLimit=120&limit=0');
out.media = await j('https://api.gbif.org/v1/occurrence/search?taxonKey=' + key + '&mediaType=StillImage&license=CC0_1_0&license=CC_BY_4_0&datasetKey=50c9509d-22c7-4a22-a47d-8c48425ef4a7&limit=3');
out.media = { count: out.media.count, ex: (out.media.results || []).map(o => ({ license: o.license, media: o.media, rightsHolder: o.rightsHolder, recordedBy: o.recordedBy, country: o.countryCode })) };
out.facetBig = await j('https://api.gbif.org/v1/occurrence/search?country=FR&kingdomKey=5&facet=speciesKey&facetLimit=20000&limit=0');
out.facetBig = { n: out.facetBig.facets ? out.facetBig.facets[0].counts.length : out.facetBig };
out.gadm = await j('https://api.gbif.org/v1/geocode/gadm/FRA.6.2_1');
out.commons = await j('https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=330&titles=File:Russula%20emetica%20-%20Lindsey%204a.jpg');
out.extract = await j('https://fr.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|pageimages&exintro=1&explaintext=1&exlimit=20&titles=Polypore_en_ombelle|Russule_%C3%A9m%C3%A9tique&redirects=1');
writeFileSync('out/sonde.json', JSON.stringify(out, null, 1));
