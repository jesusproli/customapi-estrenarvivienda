module.exports = {
  'PUT /changeStatus': function () { 
    try {
      prlbu.models.Sfprolibu.changeStatus(prlub.req.body, (err, result) => {
        if (err) return prlbu.res.send(err)
        prlbu.res.ok(result)
      })
    } catch (error) {
      prlbu.res.badRequest('[PUT /changeStatus] ' + error)
    }
  },
  'GET /getByUuid/:uuid': function () { 
    try {
      const uuid = prlbu.req.param('uuid')
      const query = { proposalNumber: uuid}
      
      if (!uuid) return prlbu.res.badRequest('Invalid required key \'uuid\' in params')
      prlbu.models.Proposal.find(query, (err, docs) => {
        prlbu.res.ok(docs)
        if (err) return prlbu.res.badRequest(err)
      })
    } catch (error) {
      prlbu.res.badRequest('[GET / ] ' + error)
    }
  }
}
