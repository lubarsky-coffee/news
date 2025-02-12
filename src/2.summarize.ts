import fs from 'fs'

import { log } from './log.ts'
import { sleep } from './sleep.ts'
import { news } from './store.ts'
import { topics, topicsMap } from '../config/topics.ts'
// import { restricted } from '../config/agencies.ts'
// import { decodeGoogleNewsUrl } from './google-news.ts'
import { fetchArticle } from './fetch-article.ts'
import { htmlToText } from './html-to-text.ts'
import { ai } from './ai.ts'

export async function summarize() {
	news.forEach((e, i) => e.id = e.id ?? i + 1)
	let order = e => (topics[e.topic]?.id ?? 99) * 10 + (+e.priority ?? 99)
	news.sort((a, b) => order(a) - order(b))
	news.forEach((e, i) => e.sqk = i + 3)

	let list = news.filter(e => e.url && !e.summary && e.topic !== 'other')

	let stats = { ok: 0, fail: 0 }
	let last = {
		urlDecode: { time: 0, delay: 25e3, increment: 1100 },
		ai: { time: 0, delay: 0 },
	}
	for (let i = 0; i < list.length; i++) {
		let e = list[i]
		log(`\n(${i + 1}/${list.length}) ${e.sqk}.`, e.titleEn || e.titleRu || '')

		// if (!e.url && !restricted.includes(e.source)) {
		// 	await sleep(last.urlDecode.time + last.urlDecode.delay - Date.now())
		// 	last.urlDecode.delay += last.urlDecode.increment
		// 	last.urlDecode.time = Date.now()
		// 	log('Decoding URL...')
		// 	e.url = await decodeGoogleNewsUrl(e.url)
		// 	if (!e.url) {
		// 		await sleep(5*60e3)
		// 		i--
		// 		continue
		// 	}
		// 	log('got', e.url)
		// }

		if (e.url) {
			log('Fetching', e.source ?? '', 'article...')
			let html = await fetchArticle(e.url)
			if (html) {
				log('got', html.length, 'chars')
				fs.writeFileSync(`articles/${e.sqk}.html`, `<!--\n${e.url}\n-->\n${html}`)
				e.text = htmlToText(html)
				fs.writeFileSync(`articles/${e.sqk}.txt`, `${e.titleEn || e.titleRu || ''}\n\n${e.text}`)
				// let skip = text.indexOf((e.titleEn ?? '').split(' ')[0])
				// if (skip > 0 && text.length - skip > 1000) {
				// 	text = text.slice(skip)
				// }
				e.text = e.text.slice(0, 30000)
			}
		}

		if (e.text) {
			await sleep(last.ai.time + last.ai.delay - Date.now())
			last.ai.time = Date.now()
			log('Summarizing', e.text.length, 'chars...')
			let res = await ai(e)
			if (res) {
				last.ai.delay = res.delay
				e.topic ||= topicsMap[res.topic]
				e.priority ||= res.priority
				e.titleRu ||= res.titleRu
				e.summary = e.text && res.summary
				e.aiTopic = topicsMap[res.topic]
				e.aiPriority = res.priority
			}
		}

		if (!e.summary) {
			log('failed to summarize')
			stats.fail++
		} else {
			stats.ok++
		}
	}
	log('\n', stats)
}

if (process.argv[1].endsWith('summarize.ts')) summarize()