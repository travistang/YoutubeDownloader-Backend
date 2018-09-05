const Error = (res,msg) => {
  return res.status(400).json({
    error: msg
  })
}
const RunFunctionWithError = async (func,res) => {
  try {
    return await func()
  } catch(e) {
    console.log('error in run function',e)
    return Error(res,e.meesage)
  }
}
const RandomToken = (length = 16) => {
  const alphaNumeric = "1234567890qwertyuiopasdfghjklzxcvbnm",
    randomInt = (min,max) => Math.random() * max + min,
    choose = (list) => list[randomInt(0,list.length)]
  let res = []
  for (let i = 0; i < length; i++) {
    res.push(choose(alphaNumeric))
  }
  return res
}


module.exports = {
  Error,
  RunFunctionWithError,
  RandomToken
}
