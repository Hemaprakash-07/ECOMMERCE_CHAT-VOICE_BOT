import os 
import sys
from typing import Any

from langchain_huggingface import HuggingFaceEndpointEmbeddings
from langchain_nvidia import NVIDIAEmbeddings
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_pinecone import PineconeVectorStore
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains import create_retrieval_chain
from langchain_core.chat_history import BaseChatMessageHistory, InMemoryChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory

from src.utils.logger import logging
from src.utils.exception import Custom_exception
from dotenv import load_dotenv
load_dotenv()



class BuildRetrievalchain:
    """
    contains helper function for creating chatbot
    embeddings, llm, prompt, vector_store, retriever, retrieval_chain
    """

    def __init__(self):
        pass



    # def load_embeddings(self) -> NVIDIAEmbeddings:
    #     try:
    #         logging.info("Initializing NVIDIA Embeddings.")
    #         embeddings = NVIDIAEmbeddings(model="nvidia/nv-embedqa-mistral-7b-v2",
    #                                     api_key=os.getenv("NVIDIA_API_KEY"),
    #                                     truncate="NONE")
                
    #         logging.info("Embeddings initialized successfully.")
    #         return embeddings
            
    #     except Exception as e:
    #         logging.error(f"Error initializing embeddings: {str(e)}")
    #         raise Custom_exception(e, sys)



    def load_embeddings(self) -> HuggingFaceEndpointEmbeddings:
        try: 
            logging.info("Initializing HF BGE Embeddings.")
            embeddings = HuggingFaceEndpointEmbeddings(
                model="BAAI/bge-small-en-v1.5",
                huggingfacehub_api_token=os.getenv("HF_API_KEY"),
            )
            logging.info("Embeddings initialized successfully.")
            return embeddings

        except Exception as e:
            logging.error(f"Error initializing embeddings: {str(e)}")
            raise Custom_exception(e, sys)

        

    def load_llm(self):
        try:
            logging.info("Initializing Llama2 model with Groq")
            llm = ChatGroq(temperature=0.6,
                        model_name="llama-3.3-70b-versatile",
                        #model_name="llama-3.1-8b-instant",
                        groq_api_key=os.getenv("GROQ_API_KEY"),
                        max_tokens=4096)
            
            logging.info("LLM initialized successfully")
            return llm
            
        except Exception as e:
            logging.error(f"Error initializing LLM: {str(e)}")
            raise Custom_exception(e, sys)
        


    def setup_prompt(self):
        try:
            logging.info("Creating prompt template")
            system_prompt = (
                "You are NexPC AI \u2014 a knowledgeable, friendly PC components specialist and "
                "customer support agent for NexPC, an Indian e-commerce store that sells premium PC hardware.\n\n"

                "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n"
                "LANGUAGE RULE  (CRITICAL \u2014 ALWAYS FOLLOW)\n"
                "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n"
                "\u2022 If the user writes in Tamil \u2192 Reply ENTIRELY in Tamil (\u0ba4\u0bae\u0bbf\u0bb4\u0bcd).\n"
                "\u2022 If the user writes in English \u2192 Reply entirely in English.\n"
                "\u2022 Mixed input \u2192 Mirror the dominant language.\n"
                "\u2022 NEVER switch language mid-response.\n\n"

                "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n"
                "WHAT WE SELL \u2014 NexPC PRODUCT CATALOG\n"
                "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n"
                "\u2022 CPU / Processors   \u2014 Intel Core i3/i5/i7/i9 (LGA1700), AMD Ryzen 5/7/9 (AM5)\n"
                "\u2022 Graphics Cards     \u2014 NVIDIA RTX 40/30 series, AMD Radeon RX 7000/6000 series\n"
                "\u2022 RAM / Memory       \u2014 DDR4 and DDR5 modules (8GB\u2013128GB kits)\n"
                "\u2022 SSD / Storage      \u2014 PCIe 4.0/5.0 NVMe M.2, SATA SSDs (500GB\u20134TB)\n"
                "\u2022 Motherboards       \u2014 ATX/mATX/ITX, Intel Z790/B760, AMD X670E/B650\n"
                "\u2022 Power Supplies     \u2014 450W\u20131600W, 80+ Bronze/Gold/Platinum/Titanium\n"
                "\u2022 CPU Coolers        \u2014 Air towers, 240mm/360mm AIOs\n"
                "\u2022 PC Cases           \u2014 Mid-tower, full-tower, mini-ITX\n\n"
                "Price range: \u20b93,499\u2013\u20b91,49,999. All prices in Indian Rupees (\u20b9).\n\n"
                "Current context about our products and inventory:\n{context}\n\n"

                "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n"
                "CORE CAPABILITIES\n"
                "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n\n"
                "1. PRODUCT INFORMATION & RECOMMENDATIONS\n"
                "   - Match products by name, brand, price range, or use-case\n"
                "   - Always use \u20b9 (never $ or \u20ac)\n"
                "   - Recommend 2\u20133 options when asked for suggestions\n"
                "   - For price range queries: list all qualifying products\n\n"

                "2. PC COMPATIBILITY CHECKING\n"
                "   - Intel 13th/14th Gen → LGA1700 → Z790 / B760 / Z690 motherboards\n"
                "   - AMD Ryzen 7000 series → AM5 → X670E / X670 / B650E / B650 motherboards\n"
                "   - AMD Ryzen 5000 series → AM4 → X570 / B550 / A520 motherboards\n"
                "   - DDR4 and DDR5 are NOT interchangeable\n"
                "   - PSU = CPU TDP + GPU TDP + 20% headroom (minimum)\n\n"

                "3. BUILD RECOMMENDATIONS\n"
                "   - Budget (\u20b940K\u201360K): Ryzen 5 7600X + RTX 4060 + 16GB DDR5 + B650 + 650W\n"
                "   - Mid-range (\u20b970K\u20131L): i5-13600K + RTX 4070 + 32GB DDR5 + Z790 + 750W\n"
                "   - High-end (\u20b91.5L+): i9-14900K + RTX 4090 + 64GB DDR5 + high-end mobo + 1000W\n\n"

                "4. ORDER PROCESSING (chat-based orders)\n"
                "   - Stock limit: 10 units per product\n"
                "   - Apply 5% GST on subtotal\n"
                "   - Generate Order IDs: ORD-CHAT-001, ORD-CHAT-002 ...\n\n"

                "5. POLICY & SUPPORT\n"
                "   - Returns: 30-day window, 7-day defective exchange\n"
                "   - Warranty: CPU/GPU 3yr, RAM lifetime, SSD 5yr, Mobo 3yr, PSU 5\u201310yr\n"
                "   - Shipping: Standard 3\u20135 days, Express 1\u20132 days, Free above \u20b9999\n"
                "   - Payment: UPI, Cards, Net Banking, COD; No-cost EMI above \u20b915,000\n\n"

                "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n"
                "RESPONSE FORMATS\n"
                "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n\n"
                "PRODUCT CARD FORMAT:\n"
                "Brand:    Intel / AMD / NVIDIA\n"
                "Product:  Core i9-14900K\n"
                "Price:    \u20b939,999 (MRP \u20b954,999 | 27% OFF)\n"
                "Specs:    24C/32T | 6.0GHz Boost | LGA1700\n"
                "---\n"
                "(Repeat for multiple products)\n\n"

                "ORDER INVOICE FORMAT:\n"
                "Order Invoice \u2014 NexPC\n"
                "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
                "Item                   Qty    Price\n"
                "[Product Name]          x1    \u20b9XX,XXX\n"
                "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
                "Subtotal:                     \u20b9XX,XXX\n"
                "GST (5%):                     \u20b9X,XXX\n"
                "TOTAL:                        \u20b9XX,XXX\n"
                "Order ID: ORD-CHAT-XXX | Status: Confirmed \u2705\n\n"

                "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n"
                "GENERAL RULES\n"
                "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n"
                "\u2022 Be warm, helpful, conversational \u2014 not robotic\n"
                "\u2022 Always use \u20b9 symbol, not Rs. or INR\n"
                "\u2022 Product not in catalog \u2192 say so and suggest alternatives\n"
                "\u2022 Context empty \u2192 use training knowledge about PC hardware pricing in India\n"
                "\u2022 Keep responses very short, clear, and suitable for Text-to-Speech voice output.\n"
                "\u2022 Use simple, natural phrasing (especially when speaking in Tamil).\n"
                "\u2022 For off-topic questions \u2192 politely redirect to PC topics\n"
            )

            prompt = ChatPromptTemplate.from_messages([
                ("system", system_prompt),
                MessagesPlaceholder(variable_name="chat_history"),
                ("human", "{input}")
            ])

            logging.info("Prompt template has been created")
            return prompt

        except Exception as e:
            logging.error(f"Error creating prompt: {str(e)}")
            raise Custom_exception(e, sys)
            


    def load_vectorstore(self, embeddings):
        try:
            logging.info("Loading vectorstore ")  
            vector_store = PineconeVectorStore.from_existing_index(index_name="rough",           # ecommerce-chatbot-project
                                                                   embedding=embeddings)

            logging.info("Successfully loaded vectorstore")
            return vector_store
        
        except Exception as e:
            raise Custom_exception(e, sys)
        


    def build_retriever(self, vector_store: PineconeVectorStore):
        try:

            logging.info("Initializing vector_store as retriever")
            retriever = vector_store.as_retriever(search_type="similarity_score_threshold",
                                                  search_kwargs={"k": 5,                    # Number of documents to return
                                                                 "score_threshold": 0.7})   # Minimum relevance threshold
                                                            
            logging.info("Retriever has be initializing")
            return retriever
        
        except Exception as e:
            logging.info(f"Error initializing retriever: {str(e)}")
            raise Custom_exception(e, sys)
        


    def build_chains(self, llm: Any, prompt: ChatPromptTemplate, retriever: Any):
        try:
            logging.info("Creating stuff document chain...")
            doc_chain = create_stuff_documents_chain(llm=llm, 
                                                    prompt=prompt,
                                                    output_parser=StrOutputParser(),
                                                    document_variable_name="context")
            
            logging.info("Creating retrieval chain...")
            retrieval_chain = create_retrieval_chain(retriever=retriever, 
                                                    combine_docs_chain=doc_chain)
            
            logging.info("Chains created successfully")
            return retrieval_chain
        
        except Exception as e:
            logging.info(f"Error creating chains {str(e)}")
            raise Custom_exception(e, sys)
        


    def build_retrieval_chain(self):
        try:
            embeddings = self.load_embeddings()
            llm = self.load_llm()
            prompt = self.setup_prompt()
            vector_store = self.load_vectorstore(embeddings)
            retriever = self.build_retriever(vector_store)
            retrieval_chain = self.build_chains(llm, prompt, retriever)

            return retrieval_chain
        except Exception as e:
            raise Custom_exception(e, sys)
        
    
    

class BuildChatbot:
    def __init__(self):
        self.store = {}  # Persistent dictionary to maintain chat history


    def get_session_id(self, session_id: str) -> BaseChatMessageHistory:
        """creates and retrieves a chat history session."""
        if session_id not in self.store:
            self.store[session_id] = InMemoryChatMessageHistory()
        return self.store[session_id]


    def initialize_chatbot(self):
        """Initializes the chatbot with session memory."""
        utils = BuildRetrievalchain()
        retrieval_chain = utils.build_retrieval_chain()

        chatbot = RunnableWithMessageHistory(runnable=retrieval_chain,
                                             get_session_history=self.get_session_id,
                                             input_messages_key="input",
                                             history_messages_key="chat_history",
                                             output_messages_key="answer")

        return chatbot
