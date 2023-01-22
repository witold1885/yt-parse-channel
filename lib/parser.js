const puppeteer = require('puppeteer')
const fs = require('fs')
const fetch = require('node-fetch')
const path = require('path')
const { isFolder, log } = require('./helper')

class Parser
{
	constructor (url) {
		this.url = url
		this.config = {}
		this.downloadPath = ''
		this.channelAlias = ''
		this.browser = null
		this.page = null
		this.firstRowsCount = null
		this.firstParsed = false
		this.parsedVideos = 0
	}

	async parse () {
		log(`Parsing from ${this.url} started`)
		await this.getConfig()
		await this.makeFolders()
		await this.init()
		await this.getVideos()
	}

	async getConfig () {
	  const configData = await fs.promises.readFile('config.json')
	  this.config = JSON.parse(configData.toString())
	}

	async makeFolders () {
	  this.downloadPath = this.config.download_path || 'downloads/'
	  const isDownloadFolderExists = await isFolder(this.downloadPath)
	  if (!isDownloadFolderExists) {
	  	await fs.promises.mkdir(this.downloadPath)
	  }
		this.channelAlias = this.url.replace('https://www.youtube.com/', '')
																.replace(/@/g, '')
																.replace('/videos', '')
	  const isChannelFolderExists = await isFolder(`${this.downloadPath}/${this.channelAlias}`)
	  if (!isChannelFolderExists) {
	  	await fs.promises.mkdir(`${this.downloadPath}/${this.channelAlias}`)
	  }
	}

	async init () {		
		this.browser = await puppeteer.launch({
			args: ['--window-size=1920,1080'],
			executablePath: this.config.puppeteer.executablePath,
	    headless: true
		})
		this.page = await this.browser.newPage()
		await this.page.setDefaultNavigationTimeout(0)
		await this.page.setViewport({
			width: 1920,
			height: 980
		})
		this.page.on('error', err => {
			log(`Error happen at the page: `, err)
		})
	}

	async getVideos () {
		await this.page.goto(this.url, { waitUntil: ['networkidle2', 'domcontentloaded'] })
		await this.getFirstRowsCount()	
	  await this.furtherScroll()
	  this.page.on('response', async (response) => {
	    if (response.url().includes('https://www.youtube.com/youtubei/v1/browse?key')) {
	    	try {
		    	await this.page.evaluate(() => {
	          window.letScroll = false;
	        });
		    	if (!this.firstParsed) {
		    		await this.parseFirstVideos()
		    		this.firstParsed = true
		    		log(`Saved ${this.parsedVideos} total images`)
		    	}
		      const data = await response.json()
	        log(`Saving images`)
		      // console.log(data.onResponseReceivedActions[0].appendContinuationItemsAction.continuationItems.length)
		      let hasMore = false
		      for await (const item of data.onResponseReceivedActions[0].appendContinuationItemsAction.continuationItems) {
		      	if (item.richItemRenderer) {
			      	const video = item.richItemRenderer.content.videoRenderer
			      	const videoTitle = video.title.runs[0].text
			      	const imageUrl = video.thumbnail.thumbnails[0].url
							const imageMaxUrl = imageUrl.split('?')[0].replace('hqdefault', 'maxresdefault')
							await this.saveImage(videoTitle, imageMaxUrl)
						}
						if (item.continuationItemRenderer) {
							hasMore = true
						}
		      }
		    	log(`Saved ${this.parsedVideos} total images`)
		    	if (!hasMore) {
						log(`Parsing from ${this.url} completed`)
						log(`Saved total ${this.parsedVideos} images`)
		    	}
		    	await this.furtherScroll()
		    } catch (e) {
		    	log(`Error: ${e}`)
		    	await this.furtherScroll()
		    }
	    }
	  })
	}

	async furtherScroll () {
	  await this.page.evaluate(() => {
	    (async () => {
	    	window.letScroll = true
	      const delay = (duration) => {
	        return new Promise((resolve) => setTimeout(resolve, duration))
	      }
	      const scroller = document.documentElement
	      while (window.letScroll) {
	        scroller.scrollTop += 1000
	        await delay(100)
	      }
	    })()
	  })
	}

	async getFirstRowsCount () {
		const videoRows = await this.page.$$('ytd-rich-grid-row')
		this.firstRowsCount = videoRows.length;
	}

	async parseFirstVideos () {
		if (this.firstRowsCount) {
			const videoRows = await this.page.$$('ytd-rich-grid-row')
      log(`Saving images`)
			for (let r = 0; r < this.firstRowsCount; r++) {
				const row = videoRows[r]
				const videoItems = await row.$$('ytd-rich-item-renderer')
				for (const item of videoItems) {
					const videoTitle = await item.$eval('yt-formatted-string#video-title', el => el.innerText.trim())
					const imageUrl = await item.$eval('yt-image > img', el => el.src)
					const imageMaxUrl = imageUrl.split('?')[0].replace('hqdefault', 'maxresdefault')
					await this.saveImage(videoTitle, imageMaxUrl)
				}
			}
		}
	}

	async saveImage (videoTitle, imageMaxUrl) {
		try {
			let imageName = videoTitle.replace(/ /g, '_')
																.replace(/\|/g, '')
																.replace(/\?/g, '')
																.replace(/"/g, '')
																.replace(/:/g, '')
																.replace(/\\/g, '')
																.replace(/\//g, '')
			// console.log(imageName)
			const filePath = `${this.downloadPath}/${this.channelAlias}/${imageName}${path.extname(imageMaxUrl)}`
	    let imageSource = await fetch(imageMaxUrl)
	    await fs.promises.writeFile(filePath, await imageSource.buffer())
	    this.parsedVideos++
	  } catch (e) {
	  	log(`Error saveImage: ${e}`)
	  }
	}
}

module.exports = Parser
