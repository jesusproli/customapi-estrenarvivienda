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
  }
}