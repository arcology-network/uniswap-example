const hre = require("hardhat");
var frontendUtil = require('@arcologynetwork/frontend-util/utils/util')

const tokenAbi = require('./Token.json');

async function main() {
  
  accounts = await ethers.getSigners(); 
  const tokens = [
      { name: "TokenA", symbol: "TKNA",  adr:"0xB1e0e9e68297aAE01347F6Ce0ff21d5f72D3fa0F" },
      { name: "TokenB", symbol: "TKNB",  adr:"0x1642dD5c38642f91E4aa0025978b572fe30Ed89d" },
      { name: "TokenC", symbol: "TKNC",  adr:"0xfbC451FBd7E17a1e7B18347337657c1F2c52B631" },
      { name: "TokenD", symbol: "TKND",  adr:"0x2249977665260A63307Cf72a4D65385cC0817CB5" },
      { name: "TokenE", symbol: "TKNE",  adr:"0x663536Ee9E60866DC936D2D65c535e795f4582D1" },
      { name: "TokenF", symbol: "TKNF",  adr:"0x010e5c3c0017b8009E926c39b072831065cc7Dc2" }
  ];
  
  var tokenInsArray=new Array();
  let tx,receipt,i;
  const decimals=18;
  for (i=0;i<tokens.length;i++) {
    const tokenIns = await ethers.getContractAt(tokenAbi.abi,tokens[i].adr);
    tokenInsArray.push(tokenIns);
  }

  console.log('===========mint token=====================')
  const mintAmount=ethers.utils.parseUnits("10", 18)
  for (i=0;i<tokens.length;i=i+3) {
    tx = await tokenInsArray[i].mint(accounts[i].address,mintAmount);
    receipt = await tx.wait();
    frontendUtil.showResult(frontendUtil.parseReceipt(receipt));

    tx = await tokenInsArray[i+1].mint(accounts[i].address,mintAmount);
    receipt = await tx.wait();
    frontendUtil.showResult(frontendUtil.parseReceipt(receipt));

    tx = await tokenInsArray[i+2].mint(accounts[i].address,mintAmount);
    receipt = await tx.wait();
    frontendUtil.showResult(frontendUtil.parseReceipt(receipt));
  }

  console.log('===========balance of token=====================')
  for(i=0;i<tokens.length;i=i+3) {
    balance = await tokenInsArray[i].balanceOf(accounts[i].address);
    formattedBalance = ethers.utils.formatUnits(balance, decimals);
    console.log(`Balance of account ${accounts[i].address}: ${formattedBalance} ${tokens[i].name}`);

    balance = await tokenInsArray[i+1].balanceOf(accounts[i].address);
    formattedBalance = ethers.utils.formatUnits(balance, decimals);
    console.log(`Balance of account ${accounts[i].address}: ${formattedBalance} ${tokens[i+1].name}`);

    balance = await tokenInsArray[i+2].balanceOf(accounts[i].address);
    formattedBalance = ethers.utils.formatUnits(balance, decimals);
    console.log(`Balance of account ${accounts[i].address}: ${formattedBalance} ${tokens[i+2].name}`);
  }

  
  console.log('===========start UniswapV3Factory=====================')
  const UniswapV3Factory = await hre.ethers.getContractFactory("UniswapV3Factory");
  const swapfactory = await UniswapV3Factory.deploy();
  await swapfactory.deployed();
  console.log("UniswapV3Factory deployed to:", swapfactory.address);

  
  console.log('===========start create UniswapV3Pool=====================')
  const fee=3000;
  var poolAdrArray=new Array();
  let PoolCreatedDate,strlen,poolAddress;
  for (i=0;i<tokens.length;i=i+3) {
    tx = await swapfactory.createPool(tokenInsArray[i].address, tokenInsArray[i+1].address, fee);
    receipt = await tx.wait();
    frontendUtil.showResult(frontendUtil.parseReceipt(receipt));
    PoolCreatedDate=frontendUtil.parseEvent(receipt,"PoolCreated");
    strlen=PoolCreatedDate.length;
    poolAddress='0x'+PoolCreatedDate.substring(strlen-40,strlen);
    console.log(`UniswapV3Pool created at ${poolAddress}, ${tokens[i].name}<--->>${tokens[i+1].name} fee:${fee}`);
    poolAdrArray.push(poolAddress); 

    tx = await swapfactory.createPool(tokenInsArray[i+1].address, tokenInsArray[i+2].address, fee);
    receipt = await tx.wait();
    frontendUtil.showResult(frontendUtil.parseReceipt(receipt));
    PoolCreatedDate=frontendUtil.parseEvent(receipt,"PoolCreated");
    strlen=PoolCreatedDate.length;
    poolAddress='0x'+PoolCreatedDate.substring(strlen-40,strlen);
    console.log(`UniswapV3Pool created at ${poolAddress}, ${tokens[i+1].name}<--->>${tokens[i+2].name} fee:${fee}`);
    poolAdrArray.push(poolAddress); 
  }
  
  
  console.log('===========start initialize UniswapV3Pool=====================')
  const sqrtPriceX96 = ethers.BigNumber.from("79228162514264337593543950336");     //1:1  
  let pool;
  for (i=0;i<poolAdrArray.length;i++) {
    pool = await ethers.getContractAt("UniswapV3Pool", poolAdrArray[i]);
    tx = await pool.initialize(sqrtPriceX96);
    receipt = await tx.wait();
    frontendUtil.showResult(frontendUtil.parseReceipt(receipt));
  }
  
  console.log('===========start deploy WETH9=====================');
  const weth9_factory = await ethers.getContractFactory("WETH9");
  const weth9 = await weth9_factory.deploy();
  await weth9.deployed();
  console.log(`Deployed WETH9 at ${weth9.address}`);
  const weth9addr=weth9.address

  console.log('===========start deploy NFTDescriptor=====================');
  const Lib = await ethers.getContractFactory("NFTDescriptor");
  const lib = await Lib.deploy();
  await lib.deployed();
  console.log(`Deployed NFTDescriptor at ${lib.address}`);
  
  console.log('===========start deploy NonfungibleTokenPositionDescriptor=====================');
  const nativeCurrencyLabelBytes = ethers.utils.formatBytes32String("ACL");
  const NonfungibleTokenPositionDescriptor_factory = await hre.ethers.getContractFactory("NonfungibleTokenPositionDescriptor", {
    signer: accounts[0],
    libraries: {
      NFTDescriptor: lib.address,
    },
  });
  const nonfungibleTokenPositionDescriptor = await NonfungibleTokenPositionDescriptor_factory.deploy(
    weth9.address,
    nativeCurrencyLabelBytes
  );
  await nonfungibleTokenPositionDescriptor.deployed();
  console.log("nonfungibleTokenPositionDescriptor deployed to:", nonfungibleTokenPositionDescriptor.address);
  
  console.log('===========start deploy NonfungiblePositionManager=====================');
  const NonfungiblePositionManager_factory = await hre.ethers.getContractFactory("NonfungiblePositionManager");
  const nonfungiblePositionManager = await NonfungiblePositionManager_factory.deploy(
    swapfactory.address,   
    weth9.address,
    nonfungibleTokenPositionDescriptor.address               
  );
  await nonfungiblePositionManager.deployed();
  console.log("NonfungiblePositionManager deployed to:", nonfungiblePositionManager.address);

  console.log('===========start deploy SwapRouter=====================');
  const router_factory = await hre.ethers.getContractFactory("SwapRouter");
  const router = await router_factory.deploy(
    swapfactory.address,   
    weth9.address            
  );
  await router.deployed();
  console.log("SwapRouter deployed to:", router.address);

  for (i=0;i<tokens.length;i=i+3) {
    await addLiquidity(nonfungiblePositionManager,tokenInsArray[i],tokenInsArray[i+1],fee,"5","5",accounts[i]);

    await addLiquidity(nonfungiblePositionManager,tokenInsArray[i+1],tokenInsArray[i+2],fee,"5","5",accounts[i]);
  }
  
  console.log('===========after addLiquidity balance of token=====================')
  for(i=0;i<tokens.length;i=i+3) {
    balance = await tokenInsArray[i].balanceOf(accounts[i].address);
    formattedBalance = ethers.utils.formatUnits(balance, decimals);
    console.log(`Balance of account ${accounts[i].address}: ${formattedBalance} ${tokens[i].name}`);

    balance = await tokenInsArray[i+1].balanceOf(accounts[i].address);
    formattedBalance = ethers.utils.formatUnits(balance, decimals);
    console.log(`Balance of account ${accounts[i].address}: ${formattedBalance} ${tokens[i+1].name}`);

    balance = await tokenInsArray[i+2].balanceOf(accounts[i].address);
    formattedBalance = ethers.utils.formatUnits(balance, decimals);
    console.log(`Balance of account ${accounts[i].address}: ${formattedBalance} ${tokens[i+2].name}`);
  }


  
  
  const amountIn=ethers.utils.parseUnits("5", 18);
  console.log('===========mint token for swap=====================')
  for (i=0;i<tokens.length;i=i+3) {
    tx = await tokenInsArray[i+2].mint(accounts[i+2].address,amountIn);
    receipt = await tx.wait();
    frontendUtil.showResult(frontendUtil.parseReceipt(receipt));
  }

  console.log('===========approve token for swap=====================')
  for (i=0;i<tokens.length;i=i+3) {
    tx = await tokenInsArray[i].connect(accounts[i]).approve(router.address,amountIn);
    receipt=await tx.wait();
    frontendUtil.showResult(frontendUtil.parseReceipt(receipt));

    tx = await tokenInsArray[i+2].connect(accounts[i+2]).approve(router.address,amountIn);
    receipt=await tx.wait();
    frontendUtil.showResult(frontendUtil.parseReceipt(receipt));
  }

  console.log('===========before swap token=====================')
  for (i=0;i<tokens.length;i=i+3) {
    balance = await tokenInsArray[i].balanceOf(accounts[i].address);
    formattedBalance = ethers.utils.formatUnits(balance, decimals);
    console.log(`Balance of account ${accounts[i].address}: ${formattedBalance} ${tokens[i].name}`);

    balance = await tokenInsArray[i+1].balanceOf(accounts[i].address);
    formattedBalance = ethers.utils.formatUnits(balance, decimals);
    console.log(`Balance of account ${accounts[i].address}: ${formattedBalance} ${tokens[i+1].name}`);

    balance = await tokenInsArray[i+2].balanceOf(accounts[i+2].address);
    formattedBalance = ethers.utils.formatUnits(balance, decimals);
    console.log(`Balance of account ${accounts[i+2].address}: ${formattedBalance} ${tokens[i+2].name}`);

    balance = await tokenInsArray[i+1].balanceOf(accounts[i+2].address);
    formattedBalance = ethers.utils.formatUnits(balance, decimals);
    console.log(`Balance of account ${accounts[i+2].address}: ${formattedBalance} ${tokens[i+1].name}`);
  }

  console.log('===========start swap token=====================')
  var txs=new Array();
  for(i=0;i<tokens.length;i=i+3) {
    txs.push(frontendUtil.generateTx(function([swapRouter,from,tokenA,tokenB,fee,amountIn]){
      const params = {
          tokenIn: tokenA,                
          tokenOut: tokenB,               
          fee: fee,                            
          recipient: from.address,                    
          deadline: Math.floor(Date.now() / 1000) + 60 * 10, 
          amountIn: amountIn, 
          amountOutMinimum: 0,                     
          sqrtPriceLimitX96: 0                     
      };
      return swapRouter.connect(from).exactInputSingle(params, {
        gasLimit: 500000000 
      });
    },router,accounts[i],tokenInsArray[i].address,tokenInsArray[i+1].address,fee,amountIn));

    txs.push(frontendUtil.generateTx(function([swapRouter,from,tokenA,tokenB,fee,amountIn]){
      const params = {
          tokenIn: tokenA,                
          tokenOut: tokenB,               
          fee: fee,                            
          recipient: from.address,                    
          deadline: Math.floor(Date.now() / 1000) + 60 * 10, 
          amountIn: amountIn, 
          amountOutMinimum: 0,                     
          sqrtPriceLimitX96: 0                     
      };
      return swapRouter.connect(from).exactInputSingle(params, {
        gasLimit: 500000000 
      });
    },router,accounts[i+2],tokenInsArray[i+2].address,tokenInsArray[i+1].address,fee,amountIn));
  }
  await frontendUtil.waitingTxs(txs);
  console.log("Swap successfully!");

  console.log('===========after swap token=====================')
  for (i=0;i<tokens.length;i=i+3) {
    balance = await tokenInsArray[i].balanceOf(accounts[i].address);
    formattedBalance = ethers.utils.formatUnits(balance, decimals);
    console.log(`Balance of account ${accounts[i].address}: ${formattedBalance} ${tokens[i].name}`);

    balance = await tokenInsArray[i+1].balanceOf(accounts[i].address);
    formattedBalance = ethers.utils.formatUnits(balance, decimals);
    console.log(`Balance of account ${accounts[i].address}: ${formattedBalance} ${tokens[i+1].name}`);

    balance = await tokenInsArray[i+2].balanceOf(accounts[i+2].address);
    formattedBalance = ethers.utils.formatUnits(balance, decimals);
    console.log(`Balance of account ${accounts[i+2].address}: ${formattedBalance} ${tokens[i+2].name}`);

    balance = await tokenInsArray[i+1].balanceOf(accounts[i+2].address);
    formattedBalance = ethers.utils.formatUnits(balance, decimals);
    console.log(`Balance of account ${accounts[i+2].address}: ${formattedBalance} ${tokens[i+1].name}`);
  }

  
  
}


async function addLiquidity(nonfungiblePositionManager,tokenInsA,tokenInsB,fee, amountA, amountB,from) {
  
  let amount0Desired=ethers.utils.parseUnits(amountA, 18);
  let amount1Desired=ethers.utils.parseUnits(amountB, 18);
  
  console.log('===========approve token=====================')
  let tx = await tokenInsA.connect(from).approve(nonfungiblePositionManager.address,amount0Desired);
  let receipt=await tx.wait();
  frontendUtil.showResult(frontendUtil.parseReceipt(receipt));
  
  tx = await tokenInsB.connect(from).approve(nonfungiblePositionManager.address,amount1Desired);
  receipt=await tx.wait();
  frontendUtil.showResult(frontendUtil.parseReceipt(receipt));

  const tokenA=tokenInsA.address;
  const tokenB=tokenInsB.address;
  

  let token0,token1;
  if(tokenA < tokenB){
    token0=tokenA;
    token1=tokenB;
  }else{
    token0=tokenB;
    token1=tokenA;

    amount0Desired=ethers.utils.parseUnits(amountB, 18);
    amount1Desired=ethers.utils.parseUnits(amountA, 18);

  }

  console.log('===========addLiquidity token=====================')
  const params = {
    token0: token0,
    token1: token1,
    fee: fee, 
    tickLower: -600,
    tickUpper: 600,
    amount0Desired: amount0Desired, 
    amount1Desired: amount1Desired,
    amount0Min: 0,
    amount1Min: 0,
    recipient: from.address, 
    deadline: Math.floor(Date.now() / 1000) + 60 * 20,
  };

  tx = await nonfungiblePositionManager.connect(from).mint(params, {
    gasLimit: 500000000,
  });

  receipt=await tx.wait();
  console.log("Liquidity added successfully!");
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
