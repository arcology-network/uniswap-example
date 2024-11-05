const hre = require("hardhat");
// const { Pool, Position } = require('@uniswap/v3-sdk');
// const { Token, CurrencyAmount, Percent } = require('@uniswap/sdk-core');
var frontendUtil = require('@arcologynetwork/frontend-util/utils/util')

async function main() {
  
  accounts = await ethers.getSigners(); 
  const tokens = [
      { name: "TokenA", symbol: "TKNA", initialSupply: 1000 },
      { name: "TokenB", symbol: "TKNB", initialSupply: 1000 },
      { name: "TokenC", symbol: "TKNC", initialSupply: 1000 },
      { name: "TokenD", symbol: "TKND", initialSupply: 1000 },
      { name: "TokenE", symbol: "TKNE", initialSupply: 1000 },
      { name: "TokenF", symbol: "TKNF", initialSupply: 1000 }
  ];
  
  var tokenInsArray=new Array();
  let tokenFactory = await ethers.getContractFactory("CustomToken");
  for (const token of tokens) {
    console.log(`Deploying ${token.name}...`);
    const tokenIns = await tokenFactory.deploy(token.name, token.symbol, token.initialSupply);
    await tokenIns.deployed();
    console.log(`Deployed ${token.name} at ${tokenIns.address}`);
    tokenInsArray.push(tokenIns);
  }


  console.log('===========start UniswapV3Factory=====================')
  const UniswapV3Factory = await hre.ethers.getContractFactory("UniswapV3Factory");
  const swapfactory = await UniswapV3Factory.deploy();
  await swapfactory.deployed();
  console.log("UniswapV3Factory deployed to:", swapfactory.address);
  
  console.log('===========start create UniswapV3Pool=====================')
  const fee=3000;
  var poolAdrArray=new Array();
  let tx,receipt,PoolCreatedDate,strlen,i;
  for (i=0;i<tokens.length;i=i+2) {
    tx = await swapfactory.createPool(tokenInsArray[i].address, tokenInsArray[i+1].address, fee);
    receipt = await tx.wait();
    frontendUtil.showResult(frontendUtil.parseReceipt(receipt));
    PoolCreatedDate=frontendUtil.parseEvent(receipt,"PoolCreated");
    strlen=PoolCreatedDate.length;
    const poolAddress='0x'+PoolCreatedDate.substring(strlen-40,strlen);
    console.log(`UniswapV3Pool created at ${poolAddress}, ${tokens[i].name}<--->>${tokens[i+1].name} fee:${fee}`);
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
    console.log("Pool initialized with sqrtPriceX96:", sqrtPriceX96.toString());
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

  for (i=0;i<tokens.length;i=i+2) {
    await addLiquidity(nonfungiblePositionManager,tokenInsArray[i],tokenInsArray[i+1],tokenInsArray[i].address,tokenInsArray[i+1].address,fee,"1","1",accounts[0].address);
  }


  console.log('===========transfer token to account=====================')
  const amountIn="0.5";
  for (i=0;i<tokens.length;i=i+2) {
    tx = await tokenInsArray[i].transfer(accounts[i+2].address,ethers.utils.parseUnits(amountIn, 18));
    receipt=await tx.wait();
    frontendUtil.showResult(frontendUtil.parseReceipt(receipt));
  }
  console.log('===========approve token for swap=====================')
  for (i=0;i<tokens.length;i=i+2) {
    tx = await tokenInsArray[i].connect(accounts[i+2]).approve(router.address,ethers.utils.parseUnits(amountIn, 18));
    receipt=await tx.wait();
    frontendUtil.showResult(frontendUtil.parseReceipt(receipt));
  }


  console.log('===========before swap token=====================')
  let balance,formattedBalance;
  const decimals=18;
  for (i=0;i<tokens.length;i=i+2) {
    balance = await tokenInsArray[i].balanceOf(accounts[i+2].address);
    formattedBalance = ethers.utils.formatUnits(balance, decimals);
    console.log(`Balance of account ${accounts[i+2].address}: ${formattedBalance} ${tokens[i].name}`);

    balance = await tokenInsArray[i+1].balanceOf(accounts[i+2].address);
    formattedBalance = ethers.utils.formatUnits(balance, decimals);
    console.log(`Balance of account ${accounts[i+2].address}: ${formattedBalance} ${tokens[i+1].name}`);
  }

  console.log('===========start swap token=====================')
  var txs=new Array();
  for(i=0;i<tokens.length;i=i+2) {
    txs.push(frontendUtil.generateTx(function([swapRouter,from,tokenA,tokenB,fee,amountIn]){
      const params = {
          tokenIn: tokenA,                
          tokenOut: tokenB,               
          fee: fee,                            
          recipient: from.address,                    
          deadline: Math.floor(Date.now() / 1000) + 60 * 10, 
          amountIn: ethers.utils.parseUnits(amountIn, 18), 
          amountOutMinimum: 0,                     
          sqrtPriceLimitX96: 0                     
      };
      return swapRouter.connect(from).exactInputSingle(params, {
        gasLimit: 500000000 
      });
    },router,accounts[i+2],tokenInsArray[i].address,tokenInsArray[i+1].address,fee,amountIn));
  }
  await frontendUtil.waitingTxs(txs);
  console.log("Swap successfully!");

  console.log('===========after swap token=====================')
  for (i=0;i<tokens.length;i=i+2) {
    balance = await tokenInsArray[i].balanceOf(accounts[i+2].address);
    formattedBalance = ethers.utils.formatUnits(balance, decimals);
    console.log(`Balance of account ${accounts[i+2].address}: ${formattedBalance} ${tokens[i].name}`);

    balance = await tokenInsArray[i+1].balanceOf(accounts[i+2].address);
    formattedBalance = ethers.utils.formatUnits(balance, decimals);
    console.log(`Balance of account ${accounts[i+2].address}: ${formattedBalance} ${tokens[i+1].name}`);
  }
}

async function addLiquidity(nonfungiblePositionManager,tokenInsA,tokenInsB,tokenA,tokenB,fee, amountA, amountB,recipient) {
  console.log('===========approve token=====================')
  let tx = await tokenInsA.approve(nonfungiblePositionManager.address,ethers.utils.parseUnits(amountA, 18));
  let receipt=await tx.wait();
  frontendUtil.showResult(frontendUtil.parseReceipt(receipt));
  
  tx = await tokenInsB.approve(nonfungiblePositionManager.address,ethers.utils.parseUnits(amountB, 18));
  receipt=await tx.wait();
  frontendUtil.showResult(frontendUtil.parseReceipt(receipt));

  let token0,token1;
  if(tokenA < tokenB){
    token0=tokenA;
    token1=tokenB;
  }else{
    token0=tokenB;
    token1=tokenA;
  }

  console.log('===========addLiquidity token=====================')
  const params = {
    token0: token0,
    token1: token1,
    fee: fee, 
    tickLower: -600,
    tickUpper: 600,
    amount0Desired: ethers.utils.parseUnits(amountA, 18), 
    amount1Desired: ethers.utils.parseUnits(amountB, 18),
    amount0Min: 0,
    amount1Min: 0,
    recipient: recipient, 
    deadline: Math.floor(Date.now() / 1000) + 60 * 20,
  };

  tx = await nonfungiblePositionManager.mint(params, {
    gasLimit: 500000000,
  });

  receipt=await tx.wait();
  console.log("Liquidity added successfully!");
}

function getPrice(percent){
  return Math.sqrt(4)*Math.pow(2,96);
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
