
const Pagination = require('./pagination')

; (async () => {
    const pagination = new Pagination()
    // const firstPage = 3706
    const firstPage = 770e3
    // ultimo é por volta de 770K
    const req = pagination.getPaginated({
        url: 'https://www.mercadobitcoin.net/api/BTC/trades/',
        page: firstPage
    })
    
    for await (const items of req) {
        console.table(items)
    }

})()